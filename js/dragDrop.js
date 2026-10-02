/* ==========================================================================
   DRAGDROP.JS - KUSURSUZ SÜRÜKLE BIRAK VE BOYUTLANDIRMA
   ========================================================================== */

import { state, saveData } from './state.js';
import { PX_PER_MIN, TOTAL_MINS, getContrastYIQ } from './calendar.js';
import { renderEvents, updateStats } from './ui.js';

export function initDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
        if (document.body.classList.contains('is-resizing')) { e.preventDefault(); return; }

        let dragData = null;
        if (e.target.classList.contains('library-item')) {
            dragData = { source: 'library', typeId: e.target.dataset.typeId };
        } else if (e.target.classList.contains('event-block')) {
            // MÜKEMMEL HAYALET HİZALAMASI (Fare kutunun neresinde?)
            const rect = e.target.getBoundingClientRect();
            dragData = { source: 'grid', id: e.target.dataset.id, offsetY: e.clientY - rect.top };
        }

        if (dragData) {
            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
            setTimeout(() => document.body.classList.add('is-dragging'), 10);
        }
    });

    document.addEventListener('dragend', () => document.body.classList.remove('is-dragging'));

    const dayCols = document.querySelectorAll('.day-column');
    dayCols.forEach(col => {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        
        col.addEventListener('drop', (e) => {
            e.preventDefault(); col.classList.remove('drag-over'); document.body.classList.remove('is-dragging');
            const day = parseInt(col.dataset.day);
            const rect = col.getBoundingClientRect();
            let yPos = e.clientY - rect.top + col.scrollTop;
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                
                // Bırakılan yer farenin tuttuğu yere (offsetY) göre kusursuz hizalanır
                if (data.offsetY) yPos -= data.offsetY; 
                if (yPos < 0) yPos = 0;

                let droppedMin = Math.round(yPos / PX_PER_MIN);
                droppedMin = Math.round(droppedMin / 5) * 5; 

                if (data.source === 'library') {
                    const template = state.eventTypes.find(t => t.id === data.typeId);
                    let duration = 60;
                    if (droppedMin + duration > TOTAL_MINS) duration = TOTAL_MINS - droppedMin;

                    state.scheduledEvents.push({
                        id: 'ev_' + Date.now(),
                        title: template.name, day: day,
                        startMin: droppedMin, duration: duration,
                        bgColor: template.color, textColor: getContrastYIQ(template.color),
                        fontWeight: '500', titleFontSize: 14, desc: '',
                        updatedAt: Date.now()
                    });
                } else if (data.source === 'grid') {
                    const ev = state.scheduledEvents.find(e => e.id === data.id);
                    if (ev) {
                        if (droppedMin + ev.duration > TOTAL_MINS) droppedMin = TOTAL_MINS - ev.duration;
                        ev.day = day;
                        ev.startMin = droppedMin;
                        ev.updatedAt = Date.now(); // Sıralamada üstünlük kazanır, diğerini ezer
                    }
                }
                saveData(); renderEvents(); updateStats();
            } catch (err) { console.error(err); }
        });
    });
}

// 1. ALT KISIMDAN UZATMA (Bitiş Saatini Ayarlar)
export function initResize(e, evtObj) {
    e.stopPropagation(); e.preventDefault();
    document.body.classList.add('is-resizing');
    const startY = e.clientY; const startDuration = evtObj.duration;
    const blockDom = document.querySelector(`[data-id="${evtObj.id}"]`);
    if(blockDom) blockDom.style.transition = 'none'; // Sürüklerken animasyonu kapat ki kasmasın

    function doDrag(moveEvent) {
        const deltaMin = Math.round((moveEvent.clientY - startY) / PX_PER_MIN);
        let newDuration = startDuration + (Math.round(deltaMin / 5) * 5);
        if (newDuration < 15) newDuration = 15;
        if (evtObj.startMin + newDuration > TOTAL_MINS) newDuration = TOTAL_MINS - evtObj.startMin;
        if (blockDom) blockDom.style.height = `${newDuration * PX_PER_MIN}px`;
    }
    function stopDrag(upEvent) {
        document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stopDrag);
        document.body.classList.remove('is-resizing');
        if(blockDom) blockDom.style.transition = '';
        
        const deltaMin = Math.round((upEvent.clientY - startY) / PX_PER_MIN);
        let newDuration = startDuration + (Math.round(deltaMin / 5) * 5);
        if (newDuration < 15) newDuration = 15;
        if (evtObj.startMin + newDuration > TOTAL_MINS) newDuration = TOTAL_MINS - evtObj.startMin;

        evtObj.duration = newDuration; evtObj.updatedAt = Date.now();
        saveData(); renderEvents(); updateStats();
    }
    document.addEventListener('mousemove', doDrag); document.addEventListener('mouseup', stopDrag);
}

// 2. ÜST KISIMDAN KISALTMA (Başlangıç Saatini Ayarlar)
export function initResizeTop(e, evtObj) {
    e.stopPropagation(); e.preventDefault();
    document.body.classList.add('is-resizing');
    const startY = e.clientY; const originalStart = evtObj.startMin; const originalDuration = evtObj.duration;
    const blockDom = document.querySelector(`[data-id="${evtObj.id}"]`);
    if(blockDom) blockDom.style.transition = 'none';

    function doDrag(moveEvent) {
        const deltaMin = Math.round((moveEvent.clientY - startY) / PX_PER_MIN);
        let snappedDelta = Math.round(deltaMin / 5) * 5;
        let newStart = originalStart + snappedDelta;
        let newDuration = originalDuration - snappedDelta;

        if (newDuration < 15) { newStart = originalStart + (originalDuration - 15); newDuration = 15; }
        if (newStart < 0) { newStart = 0; newDuration = originalDuration + originalStart; }

        if (blockDom) {
            blockDom.style.top = `${newStart * PX_PER_MIN}px`;
            blockDom.style.height = `${newDuration * PX_PER_MIN}px`;
        }
    }
    function stopDrag(upEvent) {
        document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stopDrag);
        document.body.classList.remove('is-resizing');
        if(blockDom) blockDom.style.transition = '';
        
        const deltaMin = Math.round((upEvent.clientY - startY) / PX_PER_MIN);
        let snappedDelta = Math.round(deltaMin / 5) * 5;
        let newStart = originalStart + snappedDelta;
        let newDuration = originalDuration - snappedDelta;

        if (newDuration < 15) { newStart = originalStart + (originalDuration - 15); newDuration = 15; }
        if (newStart < 0) { newStart = 0; newDuration = originalDuration + originalStart; }

        evtObj.startMin = newStart; evtObj.duration = newDuration; evtObj.updatedAt = Date.now();
        saveData(); renderEvents(); updateStats();
    }
    document.addEventListener('mousemove', doDrag); document.addEventListener('mouseup', stopDrag);
}