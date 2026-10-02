/* ==========================================================================
   DRAGDROP.JS - SÜRÜKLE BIRAK (DRAG & DROP) VE RESIZE (BOYUTLANDIRMA)
   Otomatik kaydırma (Auto-scroll) motoru dahil edilmiştir.
   ========================================================================== */

import { state, saveData } from './state.js';
import { PX_PER_MIN, TOTAL_MINS, getContrastYIQ } from './calendar.js';
import { renderEvents, updateStats } from './ui.js';

// OTOMATİK KAYDIRMA FONKSİYONU
function handleAutoScroll(e) {
    const container = document.getElementById('grid-container');
    const rect = container.getBoundingClientRect();
    const threshold = 80; // Fare ekranın üst/alt sınırına kaç px yaklaşınca kaysın?
    const speed = 12;     // Kayma hızı

    if (e.clientY < rect.top + threshold) {
        container.scrollTop -= speed;
    } else if (e.clientY > rect.bottom - threshold) {
        container.scrollTop += speed;
    }
}

export function initDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
        if (document.body.classList.contains('is-resizing')) {
            e.preventDefault();
            return;
        }

        let dragData = null;
        if (e.target.classList.contains('library-item')) {
            dragData = { source: 'library', typeId: e.target.dataset.typeId };
        } else if (e.target.classList.contains('event-block')) {
            dragData = { source: 'grid', id: e.target.dataset.id };
        }

        if (dragData) {
            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
            setTimeout(() => document.body.classList.add('is-dragging'), 10);
        }
    });

    document.addEventListener('dragend', () => {
        document.body.classList.remove('is-dragging');
    });

    const dayCols = document.querySelectorAll('.day-column');
    dayCols.forEach(col => {
        
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            col.classList.add('drag-over');
            
            // Sürüklerken otomatik kaydırmayı tetikle
            handleAutoScroll(e);
        });
        
        col.addEventListener('dragleave', () => {
            col.classList.remove('drag-over');
        });
        
        col.addEventListener('drop', (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');
            document.body.classList.remove('is-dragging');

            const day = parseInt(col.dataset.day);
            const rect = col.getBoundingClientRect();
            let yPos = e.clientY - rect.top + col.scrollTop;
            
            let droppedMin = Math.round(yPos / PX_PER_MIN);
            droppedMin = Math.round(droppedMin / 5) * 5; // 5 Dakikaya yapış (Snap)

            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));

                if (data.source === 'library') {
                    const template = state.eventTypes.find(t => t.id === data.typeId);
                    let duration = 60;
                    if (droppedMin + duration > TOTAL_MINS) duration = TOTAL_MINS - droppedMin;

                    state.scheduledEvents.push({
                        id: 'ev_' + Date.now(),
                        title: template.name,
                        day: day,
                        startMin: droppedMin,
                        duration: duration,
                        bgColor: template.color,
                        textColor: getContrastYIQ(template.color),
                        fontWeight: '500',
                        titleFontSize: 13, // Varsayılan boyut
                        desc: ''
                    });
                } else if (data.source === 'grid') {
                    const ev = state.scheduledEvents.find(e => e.id === data.id);
                    if (ev) {
                        if (droppedMin + ev.duration > TOTAL_MINS) {
                            droppedMin = TOTAL_MINS - ev.duration;
                        }
                        ev.day = day;
                        ev.startMin = droppedMin;
                    }
                }

                saveData();
                renderEvents();
                updateStats();
            } catch (err) { console.error(err); }
        });
    });
}

// KUTUYU UZATMA (RESIZE) İŞLEMİ
export function initResize(e, evtObj) {
    e.stopPropagation();
    e.preventDefault();
    document.body.classList.add('is-resizing');
    
    const startY = e.clientY;
    const startDuration = evtObj.duration;
    const blockDom = document.querySelector(`[data-id="${evtObj.id}"]`);

    function doDrag(moveEvent) {
        // Uzatırken otomatik kaydırmayı tetikle
        handleAutoScroll(moveEvent);

        const deltaY = moveEvent.clientY - startY;
        const deltaMin = Math.round(deltaY / PX_PER_MIN);
        
        let newDuration = startDuration + (Math.round(deltaMin / 5) * 5);
        
        if (newDuration < 15) newDuration = 15;
        if (evtObj.startMin + newDuration > TOTAL_MINS) newDuration = TOTAL_MINS - evtObj.startMin;

        if (blockDom) blockDom.style.height = `${newDuration * PX_PER_MIN}px`;
    }

    function stopDrag(upEvent) {
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.body.classList.remove('is-resizing');

        const deltaY = upEvent.clientY - startY;
        const deltaMin = Math.round(deltaY / PX_PER_MIN);
        
        let newDuration = startDuration + (Math.round(deltaMin / 5) * 5);
        
        if (newDuration < 15) newDuration = 15;
        if (evtObj.startMin + newDuration > TOTAL_MINS) newDuration = TOTAL_MINS - evtObj.startMin;

        evtObj.duration = newDuration;
        
        saveData();
        renderEvents();
        updateStats();
    }

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
}