from fastapi import APIRouter, HTTPException, Depends
import random
from app.core.auth import verify_token_allowed
from app.core.firebase import db, refresh_faculty_cache, get_faculty
from app.models.faculty import Faculty, AssignmentRequest, GroupUnassignmentRequest
from app.core.globals import schedule_dict
import logging

logger = logging.getLogger("faculty")
router = APIRouter(dependencies=[Depends(verify_token_allowed)])

@router.get("/")
async def fetch_all_faculty():
    try:
        faculty_list = get_faculty()
        return {"status": "success", "faculty": faculty_list}
    except Exception as e:
        logger.exception("Unexpected error in fetch_all_faculty")
        raise HTTPException(status_code=500, detail="Internal Server Error in fetch_all_faculty")

@router.post("/add")
async def add_faculty(faculty: Faculty):
    try:
        refresh_faculty_cache()
        if faculty.id is None:
            faculty.id = random.randint(1, 1000000)
        db.collection("faculty").document(str(faculty.id)).set(faculty.dict())
        return {"status": "success", "message": "Faculty added successfully.", "faculty": faculty.dict()}
    except Exception as e:
        logger.exception("Unexpected error in add_faculty")
        raise HTTPException(status_code=500, detail="Internal Server Error in add_faculty")

@router.put("/update/{faculty_id}")
async def update_faculty(faculty_id: int, faculty: Faculty):
    try:
        faculty_ref = db.collection("faculty").document(str(faculty_id))
        doc = faculty_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Faculty not found")
    
        existing_data = doc.to_dict()
        updated_data = {**existing_data, **faculty.dict(exclude_unset=True)}
        updated_data["id"] = existing_data.get("id", faculty_id)
        faculty_ref.update(updated_data)
        refresh_faculty_cache()
        return {"status": "success", "message": f"Faculty {faculty_id} updated successfully.", "faculty": updated_data}
    except HTTPException as he:
        logger.error(f"HTTP error in update_faculty: {he.detail}")
        raise he
    except Exception as e:
        logger.exception("Unexpected error in update_faculty")
        raise HTTPException(status_code=500, detail="Internal Server Error in update_faculty")

@router.delete("/delete/{faculty_id}")
async def delete_faculty(faculty_id: int):
    try:
        refresh_faculty_cache()
        faculty_ref = db.collection("faculty").document(str(faculty_id))
        doc = faculty_ref.get()
    
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Faculty not found")
    
        faculty_data = doc.to_dict()
        archived_faculty_ref = db.collection("archived_faculty").document(str(faculty_id))
    
        batch = db.batch()
        batch.set(archived_faculty_ref, faculty_data)
        batch.delete(faculty_ref)
        batch.commit()
    
        for event in schedule_dict.values():
            if event.get("faculty") == faculty_data.get("name", ""):
                event["faculty"] = ""
    
        return {"status": "success", "message": f"Faculty {faculty_id} archived and deleted from active faculty."}
    except HTTPException as he:
        logger.error(f"HTTP error in delete_faculty: {he.detail}")
        raise he
    except Exception as e:
        logger.exception("Unexpected error in delete_faculty")
        raise HTTPException(status_code=500, detail="Internal Server Error in delete_faculty")

@router.post("/assign")
async def assign_faculty(request: AssignmentRequest):
    """
    Assign faculty to a group of events.
    Handles merged classes by using baseCourseCode for grouping.
    All events with the same baseCourseCode, program, and block are grouped together.
    """
    try:
        # Handle schedule_id with -A or -B suffixes (merged classes)
        schedule_id = str(request.schedule_id)
        
        # Try to find the event with the exact ID first
        event = schedule_dict.get(schedule_id)
        
        # If not found, search through all events
        if not event:
            for key, evt in schedule_dict.items():
                if str(key) == schedule_id or str(evt.get('schedule_id')) == schedule_id:
                    event = evt
                    logger.info(f"Found event using search: {key}")
                    break
        
        if not event:
            logger.error(f"Event not found for schedule_id: {schedule_id}")
            logger.error(f"Available schedule_dict keys (first 10): {list(schedule_dict.keys())[:10]}")
            raise HTTPException(status_code=404, detail=f"Event not found with ID: {schedule_id}")

        faculty = next((f for f in get_faculty() if f["id"] == request.faculty_id), None)
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty not found")

        # Use baseCourseCode for grouping (handles merged classes)
        base_code = event.get("baseCourseCode", event["courseCode"].rstrip("AL"))
        event_program = event.get("program", event.get("Program", ""))
        event_block = event.get("block", event.get("Block", ""))
        
        group_key = (base_code, event_program, event_block)
        
        logger.info(f"Assigning faculty {faculty['name']} to group: {group_key}")
        
        # Find all events in the same group (includes merged blocks with same base code)
        group_events = []
        for key, e in schedule_dict.items():
            e_base_code = e.get("baseCourseCode", e.get("courseCode", "").rstrip("AL"))
            e_program = e.get("program", e.get("Program", ""))
            e_block = e.get("block", e.get("Block", ""))
            e_group_key = (e_base_code, e_program, e_block)
            if e_group_key == group_key:
                group_events.append(e)
        
        logger.info(f"Found {len(group_events)} events in group (including merged classes)")
        
        # Get all currently assigned events for this faculty
        assigned_events = [e for e in schedule_dict.values() if e.get("faculty") == faculty["name"]]

        # Check for time conflicts
        for ge in group_events:
            ge_period = ge.get("period", "")
            if not ge_period:
                continue
                
            # Parse time period
            try:
                ge_parts = ge_period.split(" - ")
                if len(ge_parts) != 2:
                    continue
                ge_start_str, ge_end_str = ge_parts[0], ge_parts[1]
                
                def parse_time_to_minutes(time_str):
                    parts = time_str.strip().split()
                    if len(parts) != 2:
                        return None
                    time_parts = parts[0].split(":")
                    if len(time_parts) != 2:
                        return None
                    hours = int(time_parts[0])
                    minutes = int(time_parts[1])
                    meridiem = parts[1].upper()
                    if meridiem == "PM" and hours != 12:
                        hours += 12
                    elif meridiem == "AM" and hours == 12:
                        hours = 0
                    return hours * 60 + minutes
                
                ge_start = parse_time_to_minutes(ge_start_str)
                ge_end = parse_time_to_minutes(ge_end_str)
                
                if ge_start is None or ge_end is None:
                    continue
                    
            except Exception as e:
                logger.warning(f"Could not parse time for event {ge.get('schedule_id')}: {e}")
                continue

            # Check against all assigned events
            for ae in assigned_events:
                if ae.get("day") != ge.get("day"):
                    continue
                    
                ae_period = ae.get("period", "")
                if not ae_period:
                    continue
                    
                try:
                    ae_parts = ae_period.split(" - ")
                    if len(ae_parts) != 2:
                        continue
                    ae_start_str, ae_end_str = ae_parts[0], ae_parts[1]
                    ae_start = parse_time_to_minutes(ae_start_str)
                    ae_end = parse_time_to_minutes(ae_end_str)
                    
                    if ae_start is None or ae_end is None:
                        continue
                    
                    # Check for overlap
                    if ge_start < ae_end and ae_start < ge_end:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Schedule conflict on {ge.get('day')}: {ge['period']} overlaps with event {ae.get('schedule_id')} ({ae['period']})"
                        )
                except Exception as e:
                    logger.warning(f"Could not check conflict for event {ae.get('schedule_id')}: {e}")
                    continue

        # Assign faculty to all events in the group (including merged classes)
        for ge in group_events:
            ge["faculty"] = faculty["name"]
            logger.info(f"Assigned {faculty['name']} to event {ge.get('schedule_id')} (Block {ge.get('block')})")

        return {
            "status": "success",
            "message": f"Assigned {faculty['name']} to {len(group_events)} event(s) in the group",
            "events": group_events
        }
    except HTTPException as he:
        logger.error(f"HTTP error in assign_faculty: {he.detail}")
        raise he
    except Exception as e:
        logger.exception("Unexpected error in assign_faculty")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.post("/unassign")
async def unassign_faculty_group(request: GroupUnassignmentRequest):
    """
    Unassign faculty from a group of events.
    Handles merged classes by using baseCourseCode for grouping.
    """
    try:
        # Use baseCourseCode for grouping (strip suffixes if needed)
        group_events = []
        request_base_code = request.courseCode.rstrip("AL")
        
        logger.info(f"Unassigning group: {request_base_code}, {request.program}, {request.block}")
        
        for e in schedule_dict.values():
            event_base_code = e.get("baseCourseCode", e.get("courseCode", "").rstrip("AL"))
            
            # Match on base course code, program, and block
            if (event_base_code == request_base_code and 
                e.get("program") == request.program and 
                e.get("block") == request.block):
                group_events.append(e)
        
        if not group_events:
            raise HTTPException(
                status_code=404, 
                detail=f"No matching events found for {request_base_code}, {request.program}, Block {request.block}"
            )
        
        logger.info(f"Found {len(group_events)} events to unassign (including merged classes)")
        
        # Unassign faculty from all events
        for e in group_events:
            logger.debug(f"Unassigning event {e['schedule_id']} (Block {e['block']})")
            e["faculty"] = ""
        
        return {
            "status": "success", 
            "message": f"Faculty unassigned from {len(group_events)} event(s)", 
            "events": group_events
        }
    except HTTPException as he:
        logger.error(f"HTTP error in unassign_faculty_group: {he.detail}")
        raise he
    except Exception as e:
        logger.exception("Unexpected error in unassign_faculty_group")
        raise HTTPException(status_code=500, detail="Internal Server Error in unassign_faculty_group")