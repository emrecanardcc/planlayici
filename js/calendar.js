/* ==========================================================================
   CALENDAR.JS - MATEMATİK, SAAT DÖNÜŞÜMLERİ VE ÇAKIŞMA ALGORİTMASI
   ========================================================================== */

export const PX_PER_MIN = 1.5; // 1 Dakika = 1.5 Piksel
export const TOTAL_MINS = 1440; // 24 Saat * 60 Dakika

/** Saati dakikaya çevirir (Örn: "07:30" -> 450) */
export function timeToMins(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
}

/** Dakikayı saate çevirir (Örn: 450 -> "07:30") */
export function minsToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

/** 
 * Arkaplan rengine bakarak yazının siyah mı yoksa beyaz mı olması 
 * gerektiğine karar verir (Mükemmel okunabilirlik için - YIQ Algoritması) 
 */
export function getContrastYIQ(hexcolor) {
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) {
        hexcolor = hexcolor.split('').map(c => c + c).join('');
    }
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // Koyu arkaplansa beyaz (#ffffff), açıksa koyu lacivert/siyah döndür
    return (yiq >= 128) ? '#0f172a' : '#ffffff';
}

/**
 * ÇAKIŞMA ALGORİTMASI (Overlap Logic)
 * Aynı gün içindeki etkinlikleri tarar. Eğer saatleri çakışıyorsa,
 * CSS'te width (genişlik) ve left (sol boşluk) değerlerini hesaplayıp,
 * yan yana dizilmelerini sağlar.
 */
export function calculateOverlaps(eventsForDay) {
    // 1. Etkinlikleri başlangıç saatine göre sırala
    const sortedEvents = [...eventsForDay].sort((a, b) => a.startMin - b.startMin);
    
    // 2. Sütunları (columns) tutacağımız dizi
    const columns = []; 

    sortedEvents.forEach(evt => {
        let placed = false;
        
        // Mevcut sütunları kontrol et. Bu etkinlik, bu sütundaki son etkinlikle çakışıyor mu?
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const lastEventInColumn = column[column.length - 1];
            
            // Eğer sütundaki son etkinliğin bitiş saati, yeni etkinliğin başlangıç saatinden 
            // küçük veya eşitse, çakışmıyor demektir. Aynı sütuna ekleyebiliriz.
            if (lastEventInColumn.startMin + lastEventInColumn.duration <= evt.startMin) {
                column.push(evt);
                evt.columnIndex = i;
                placed = true;
                break;
            }
        }
        
        // Hiçbir sütuna sığmadıysa (hepsiyle çakışıyorsa), yeni bir sütun aç
        if (!placed) {
            columns.push([evt]);
            evt.columnIndex = columns.length - 1;
        }
    });

    // 3. Her etkinlik için CSS genişlik (width) ve sol pozisyon (left) hesapla
    const columnCount = columns.length;
    
    sortedEvents.forEach(evt => {
        // Eğer çakışma yoksa (columnCount = 1) tam genişlik.
        // Çakışma varsa (örn 2 etkinlik), genişlik %50 olur, biri solda biri sağda durur.
        evt.visual = {
            width: `calc(${100 / columnCount}% - 4px)`, // -4px kenar boşlukları (margin) için
            left: `calc(${evt.columnIndex * (100 / columnCount)}% + 2px)`
        };
    });

    return sortedEvents;
}