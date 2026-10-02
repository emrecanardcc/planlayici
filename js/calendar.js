/* ==========================================================================
   CALENDAR.JS - MATEMATİK VE ÇAKIŞMA İPTAL ALGORİTMASI
   ========================================================================== */

export const PX_PER_MIN = 1.5; 
export const TOTAL_MINS = 1440; 

export function timeToMins(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
}

export function minsToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

export function getContrastYIQ(hexcolor) {
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c + c).join('');
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#09090b' : '#ffffff';
}

/**
 * ÇAKIŞMA İPTAL ALGORİTMASI (Push-Down Logic)
 * Üst üste etkinlik bindiğinde eski olanı (updatedAt değeri küçük olanı) yumuşakça aşağı iter.
 */
export function resolveOverlaps(eventsForDay) {
    // Önce saate göre, eğer saatler aynıysa EN SON güncellenene (yeni konulana) göre sırala
    eventsForDay.sort((a, b) => {
        if (a.startMin === b.startMin) {
            return (b.updatedAt || 0) - (a.updatedAt || 0); 
        }
        return a.startMin - b.startMin;
    });

    let currentMin = 0;
    eventsForDay.forEach(evt => {
        // Eğer bu etkinlik, bir öncekinin altında ezildiyse (çakışıyorsa) aşağı it
        if (evt.startMin < currentMin) {
            evt.startMin = currentMin;
        }
        
        // Gece yarısını aşmasını engelle
        if (evt.startMin + evt.duration > TOTAL_MINS) {
            if (evt.startMin >= TOTAL_MINS) {
                evt.startMin = TOTAL_MINS - 15;
                evt.duration = 15;
            } else {
                evt.duration = TOTAL_MINS - evt.startMin;
            }
        }
        
        currentMin = evt.startMin + evt.duration;

        // Artık yan yana sıkışmak yok, her etkinlik tam sütun genişliğinde
        evt.visual = { width: 'calc(100% - 8px)', left: '4px' };
    });
    return eventsForDay;
}