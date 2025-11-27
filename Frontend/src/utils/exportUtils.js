// exportUtils.js
import leftLogo from '../assets/GClogo.png';
import rightLogo from '../assets/CSSlogo.png';

/**
 * Extract semester and academic year from schedule name
 */
export const extractScheduleInfo = (name) => {
  let semester = '';
  let academicYear = '';
  
  if (!name) return { semester, academicYear };

  const p1 = /(\d{4}-\d{4})\s+(\d)(?:st|nd|rd|th)?\s*sem/i;
  let m = name.match(p1);
  if (m) {
    const num = m[2];
    const suffix = num === '1' ? 'st' : num === '2' ? 'nd' : num === '3' ? 'rd' : 'th';
    return { semester: `${num}${suffix}`, academicYear: m[1] };
  }

  const p2 = /(\d{4}-\d{4})\s+Midyear/i;
  m = name.match(p2);
  if (m) {
    return { semester: 'Midyear', academicYear: m[1] };
  }
  
  return { semester, academicYear };
};

/**
 * Helper to join arrays naturally
 * e.g., ['A', 'B'] -> "A and B"
 * e.g., ['A', 'B', 'C'] -> "A, B, and C"
 */
const formatNaturalList = (items) => {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
};

/**
 * Helper for ordinal suffixes (1st, 2nd, 3rd)
 */
const getOrdinal = (n) => {
  const num = parseInt(n);
  if (num === 1) return '1st';
  if (num === 2) return '2nd';
  if (num === 3) return '3rd';
  return `${num}th`;
};

/**
 * Format filter information to be descriptive and professional
 */
export const formatFilterInfo = (filterInfo) => {
  if (!filterInfo) return '';
  
  // 1. Handle String Format (Legacy fallback)
  if (typeof filterInfo === 'string') {
    return filterInfo; 
  }
  
  // 2. Handle Object Format (Advanced Filters)
  if (typeof filterInfo === 'object') {
    const parts = [];
    
    // Search Query
    if (filterInfo.courseQuery && filterInfo.courseQuery.trim()) {
      parts.push(`Matches search "${filterInfo.courseQuery.trim()}"`);
    }

    // Programs
    if (filterInfo.programSelected?.length > 0) {
      parts.push(`Restricted to ${formatNaturalList(filterInfo.programSelected)} programs`);
    } else if (filterInfo.program && filterInfo.program !== 'all') {
      parts.push(`Restricted to ${filterInfo.program} program`);
    }

    // Years
    if (filterInfo.yearSelected?.length > 0) {
      const formattedYears = filterInfo.yearSelected.map(y => getOrdinal(y));
      parts.push(`Limited to ${formatNaturalList(formattedYears)} year levels`);
    } else if (filterInfo.year && filterInfo.year !== 'all') {
      parts.push(`Limited to ${getOrdinal(filterInfo.year)} year level`);
    }

    // Blocks
    if (filterInfo.blockSelected?.length > 0) {
      parts.push(`Specific to Block ${formatNaturalList(filterInfo.blockSelected)}`);
    } else if (filterInfo.block && filterInfo.block !== 'all') {
      parts.push(`Specific to Block ${filterInfo.block}`);
    }

    // Days
    if (filterInfo.daySelected?.length > 0) {
      parts.push(`Scheduled on ${formatNaturalList(filterInfo.daySelected)}`);
    }

    // Rooms
    if (filterInfo.roomSelected?.length > 0) {
      if (filterInfo.roomSelected.length > 5) {
         parts.push(`Located in ${filterInfo.roomSelected.length} specific rooms`);
      } else {
         parts.push(`Located in ${formatNaturalList(filterInfo.roomSelected)}`);
      }
    }

    // Unassigned
    if (filterInfo.showUnassignedOnly) {
      parts.push(`Showing only unassigned faculty courses`);
    }

    if (parts.length === 0) return ''; // Return empty if no filters applied
    
    // Join distinct criteria with a bullet or pipe for clean separation
    return parts.join(' • ');
  }
  
  return '';
};

/**
 * Helper for getting data URL from image
 */
const getDataUrl = (img) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(getDataUrl(img));
    img.onerror = reject;
    img.src = src;
  });

/**
 * Export schedule data to PDF
 */
export const exportToPDF = async (scheduleData, scheduleName, filterInfo) => {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) return alert('jsPDF not available');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const { semester, academicYear } = extractScheduleInfo(scheduleName);
  const w = doc.internal.pageSize.getWidth();
  const m = 12;

  try {
    const [leftData, rightData] = await Promise.all([loadImage(leftLogo), loadImage(rightLogo)]);
    doc.addImage(leftData, 'PNG', m, m, 30, 30);
    doc.addImage(rightData, 'PNG', w - m - 30, m, 30, 30);
  } catch (e) {
    console.warn('Logo load failed', e);
  }

  // Header
  doc.setFont('helvetica', 'bold').setFontSize(12)
    .text('City of Olongapo', w / 2, m + 6, { align: 'center' })
    .setFont('helvetica', 'bold').setFontSize(14)
    .text('GORDON COLLEGE', w / 2, m + 13, { align: 'center' })
    .setFont('helvetica', 'bold').setFontSize(12)
    .text('College of Computer Studies', w / 2, m + 19, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(9)
    .text('Olongapo City Sports Complex, East Tapinac, Olongapo City', w / 2, m + 26, { align: 'center' })
    .text('Tel. No. (047) 224-2089 loc. 314', w / 2, m + 31, { align: 'center' })
    .text('www.gordoncollege.edu.ph', w / 2, m + 36, { align: 'center' });
  doc.setDrawColor(0).setLineWidth(0.4)
    .line(m, m + 40, w - m, m + 40);

  // Title
  let y = m + 48;
  doc.setFont('helvetica', 'bold').setFontSize(16)
    .text('GENERATED SCHEDULE', w / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(11)
    .text(`Semester: ${semester} | AY: ${academicYear}`, w / 2, y + 7, { align: 'center' });

  // Add formatted filter information
  y += 13;
  const formattedFilterInfo = formatFilterInfo(filterInfo);
  if (formattedFilterInfo) {
    // Label
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(50)
       .text('Selection Criteria:', m, y);
    
    // Content (Wrapped text for long filters)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(0);
    const splitText = doc.splitTextToSize(formattedFilterInfo, w - (m * 2) - 30);
    doc.text(splitText, m + 32, y);
    
    // Adjust Y based on how many lines the filter took
    y += (splitText.length * 4); 
  }
  
  // Table
  y += 4;
  const tableW = w - 2 * m;
  doc.autoTable({
    head: [['Course Code','Course Title','Session','Program','Year','Block','Day','Time','Room','Faculty']],
    body: scheduleData.map(ev => [
      ev.courseCode, ev.title, ev.session, ev.program,
      ev.year, ev.block, ev.day, ev.period, ev.room, ev.faculty || 'Unassigned'
    ]),
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8, textColor: [0,0,0], cellPadding: 1.2, lineColor: [0,0,0], lineWidth: 0.15 },
    tableWidth: tableW,
    margin: { left: m, right: m },
    headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: 'bold', halign: 'center' }
  });

  const filename = `Generated_Schedule_${semester}_${academicYear.replace('-', '_')}`;
  doc.save(`${filename}.pdf`);
};

/**
 * Export schedule data to Excel
 */
export const exportToExcel = (scheduleData, scheduleName, filterInfo) => {
  const { semester, academicYear } = extractScheduleInfo(scheduleName);
  
  // Header information
  const header = [
    [`Gordon College - College of Computer Studies`],
    [`Academic Year: ${academicYear}`, `Semester: ${semester}`],
    []
  ];
  
  // Add formatted filter information
  const formattedFilterInfo = formatFilterInfo(filterInfo);
  if (formattedFilterInfo) {
    // Excel doesn't support bolding parts of a cell easily without complex libs,
    // so we just put the whole string in.
    header.push([`Selection Criteria: ${formattedFilterInfo}`]);
    header.push([]);
  }
  
  const tblHead = ['Course Code','Course Title','Session','Program','Year','Block','Day','Time','Room','Faculty'];
  const rows = scheduleData.map(ev => [
    ev.courseCode, ev.title, ev.session, ev.program,
    ev.year, ev.block, ev.day, ev.period, ev.room, ev.faculty || 'Unassigned'
  ]);

  const wsData = [...header, tblHead, ...rows];
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(wsData);
  
  ws['!cols'] = [
    { wch:15 },{ wch:30 },{ wch:10 },{ wch:15 },{ wch:5 },
    { wch:5 },{ wch:8 },{ wch:15 },{ wch:10 },{ wch:25 }
  ];
  
  if (ws.A1) ws.A1.s = { font:{ bold:true, sz:14 }, alignment:{ horizontal:'center' } };
  
  window.XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
  
  const filename = `Generated_Schedule_${semester}_${academicYear.replace('-', '_')}`;
  window.XLSX.writeFile(wb, `${filename}.xlsx`);
};