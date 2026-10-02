/* ==========================================================================
   UI.JS - EKRAN ÇİZİMİ, OTO-ODAKLANMA VE MODAL YÖNETİMİ
   ========================================================================== */

import { state, saveData, addEventType, deleteEventType, deleteScheduledEvent } from './state.js';
import { resolveOverlaps, PX_PER_MIN, TOTAL_MINS, minsToTime, getContrastYIQ, timeToMins } from './calendar.js';
import { initResize, initResizeTop } from './dragDrop.js';

let activeEditingId = null;
let draggedLibraryItem = null; 

export function initUI() {
    document.documentElement.setAttribute('data-theme', state.theme);
    
    const titleEl = document.getElementById('app-title');
    titleEl.innerText = state.appTitle;
    titleEl.addEventListener('blur', () => { state.appTitle = titleEl.innerText; saveData(); });

    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme); saveData();
    });
    document.getElementById('pdf-export-btn').addEventListener('click', () => window.print());

    document.getElementById('add-event-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('new-event-name');
        const colorInput = document.getElementById('new-event-color');
        if (nameInput.value.trim()) { addEventType(nameInput.value.trim(), colorInput.value); nameInput.value = ''; renderLibrary(); }
    });

    // UYKU OTOMASYONU VE OTOMATİK EKRAN ODAKLANMASI
    document.getElementById('apply-sleep-btn').addEventListener('click', () => {
        const startMins = timeToMins(document.getElementById('sleep-start').value);
        const endMins = timeToMins(document.getElementById('sleep-end').value);
        const sleepColor = state.theme === 'light' ? '#312e81' : '#1e1b4b'; 

        state.scheduledEvents = state.scheduledEvents.filter(e => e.title !== 'Uyku (Sistem)');

        for (let day = 0; day < 7; day++) {
            if (startMins < endMins) {
                state.scheduledEvents.push({ id: `slp_${day}_${Date.now()}`, title: 'Uyku (Sistem)', day: day, startMin: startMins, duration: endMins - startMins, bgColor: sleepColor, textColor: '#fff', fontWeight: '500', titleFontSize: 13, desc: '', updatedAt: 0 });
            } else {
                state.scheduledEvents.push({ id: `slp_a_${day}_${Date.now()}`, title: 'Uyku (Sistem)', day: day, startMin: startMins, duration: TOTAL_MINS - startMins, bgColor: sleepColor, textColor: '#fff', fontWeight: '500', titleFontSize: 13, desc: '', updatedAt: 0 });
                state.scheduledEvents.push({ id: `slp_b_${day}_${Date.now()}`, title: 'Uyku (Sistem)', day: day, startMin: 0, duration: endMins, bgColor: sleepColor, textColor: '#fff', fontWeight: '500', titleFontSize: 13, desc: '', updatedAt: 0 });
            }
        }
        
        state.wakeTime = endMins; // Uyanış saatini hafızaya al
        saveData(); renderEvents(); updateStats(); scrollToWakeTime();
    });

    setupModal(); renderLibrary(); renderGridBase(); renderEvents(); updateStats();
    
    // Uygulama ilk açıldığında otomatik olarak uyanış saatine kaydır
    setTimeout(scrollToWakeTime, 100);
}

// OTOMATİK ODAKLANMA (Scroll Lock ve Focus)
function scrollToWakeTime() {
    if (state.wakeTime > 0) {
        const container = document.getElementById('grid-container');
        const targetY = (state.wakeTime * PX_PER_MIN) - 20; // 20px nefes boşluğu
        container.scrollTo({ top: targetY, behavior: 'smooth' });
    }
}

export function renderLibrary() {
    const libraryContainer = document.getElementById('event-library');
    libraryContainer.innerHTML = '';
    state.eventTypes.forEach(type => {
        const item = document.createElement('div');
        item.className = 'library-item'; item.draggable = true; item.dataset.typeId = type.id;
        item.innerHTML = `<span class="library-item-color" style="background:${type.color}"></span> <span class="library-item-name">${type.name}</span> <div class="library-item-actions"><button class="btn btn-icon delete-type-btn" style="color:var(--danger-color); padding:2px;">&times;</button></div>`;
        item.querySelector('.delete-type-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteEventType(type.id); renderLibrary(); });
        
        item.addEventListener('dragstart', (e) => { draggedLibraryItem = item; e.dataTransfer.setData('application/json', JSON.stringify({ source: 'library', typeId: type.id })); setTimeout(() => item.style.opacity = '0.5', 0); });
        item.addEventListener('dragend', () => { item.style.opacity = '1'; draggedLibraryItem = null; });
        item.addEventListener('dragover', (e) => { e.preventDefault(); if (draggedLibraryItem !== item) { item.style.transform = 'scale(1.02)'; item.style.borderColor = 'var(--primary-color)'; } });
        item.addEventListener('dragleave', () => { item.style.transform = ''; item.style.borderColor = ''; });
        item.addEventListener('drop', (e) => {
            e.stopPropagation(); item.style.transform = ''; item.style.borderColor = '';
            if (draggedLibraryItem && draggedLibraryItem !== item) {
                const srcIndex = state.eventTypes.findIndex(t => t.id === draggedLibraryItem.dataset.typeId);
                const tgtIndex = state.eventTypes.findIndex(t => t.id === item.dataset.typeId);
                const [movedType] = state.eventTypes.splice(srcIndex, 1);
                state.eventTypes.splice(tgtIndex, 0, movedType);
                saveData(); renderLibrary();
            }
        });
        libraryContainer.appendChild(item);
    });
}

export function renderGridBase() {
    const gridBody = document.getElementById('grid-body');
    gridBody.style.height = `${TOTAL_MINS * PX_PER_MIN}px`;
    const timeCol = document.createElement('div'); timeCol.className = 'time-column';
    for (let h = 0; h <= 24; h++) {
        if (h < 24) {
            const label = document.createElement('div'); label.className = 'time-label';
            label.style.top = `${(h * 60) * PX_PER_MIN}px`; label.innerText = `${h.toString().padStart(2,'0')}:00`;
            timeCol.appendChild(label);
        }
    }
    gridBody.appendChild(timeCol);
    for (let day = 0; day < 7; day++) { const dayCol = document.createElement('div'); dayCol.className = 'day-column'; dayCol.dataset.day = day; gridBody.appendChild(dayCol); }
}

export function renderEvents() {
    const dayCols = document.querySelectorAll('.day-column');
    const renderedIds = new Set(); // Sadece var olanları korumak (Smooth animasyon) için

    for (let day = 0; day < 7; day++) {
        const dayCol = dayCols[day];
        if (!dayCol) continue;

        const dayEvents = state.scheduledEvents.filter(e => e.day === day);
        const processedEvents = resolveOverlaps(dayEvents); // Smooth aşağı kaydırma algoritması çağrıldı

        processedEvents.forEach(evt => {
            renderedIds.add(evt.id);
            let block = dayCol.querySelector(`.event-block[data-id="${evt.id}"]`);
            
            // Eğer kutu daha önce yoksa yeni yarat
            if (!block) {
                block = document.createElement('div');
                block.className = 'event-block';
                block.dataset.id = evt.id;
                block.draggable = true;
                dayCol.appendChild(block);
            }

            // CSS Değerlerini Güncelle (Değerler değiştiğinde animasyon devreye girecek)
            block.style.backgroundColor = evt.bgColor || '#3b82f6';
            block.style.color = evt.textColor || getContrastYIQ(evt.bgColor);
            block.style.fontWeight = evt.fontWeight || '500';
            block.style.top = `${evt.startMin * PX_PER_MIN}px`;
            block.style.height = `${evt.duration * PX_PER_MIN}px`;
            block.style.width = evt.visual.width;
            block.style.left = evt.visual.left;

            const startTime = minsToTime(evt.startMin);
            const endTime = minsToTime(evt.startMin + evt.duration);
            const showTime = (evt.duration * PX_PER_MIN) > 25;
            const fontSize = evt.titleFontSize || 14;
            
            // Üstten Tutma Çubuğu (resize-handle-top) Eklendi
            block.innerHTML = `
                <div class="resize-handle-top"></div>
                ${showTime ? `<div class="event-time">${startTime} -${endTime}</div>` : ''}
                <div class="event-title" style="font-size: ${fontSize}px;">${evt.title}</div>
                ${evt.desc && showTime ? `<div class="event-desc">${evt.desc}</div>` : ''}
                <div class="event-edit-icon" title="Düzenle">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </div>
                <div class="resize-handle"></div>
            `;

            block.querySelector('.event-edit-icon').addEventListener('click', (e) => { e.stopPropagation(); openModal(evt.id); });
            block.querySelector('.resize-handle').addEventListener('mousedown', (e) => initResize(e, evt));
            block.querySelector('.resize-handle-top').addEventListener('mousedown', (e) => initResizeTop(e, evt));
        });
    }

    // Silinenleri ekrandan temizle
    document.querySelectorAll('.event-block').forEach(el => {
        if (!renderedIds.has(el.dataset.id)) el.remove();
    });
}

export function updateStats() {
    const statsContainer = document.getElementById('stats-container');
    statsContainer.innerHTML = '';
    let totalMins = 0; const typeTotals = {};
    state.scheduledEvents.forEach(e => {
        if(e.title === 'Uyku (Sistem)') return; // Uykuyu haftalık analiz saatine katmamak daha iyidir
        totalMins += e.duration;
        if (!typeTotals[e.bgColor]) typeTotals[e.bgColor] = { name: e.title, mins: 0, color: e.bgColor };
        typeTotals[e.bgColor].mins += e.duration;
    });

    if (totalMins === 0) { statsContainer.innerHTML = '<span style="font-size:13px; color:var(--text-muted);">Henüz planlanmış etkinlik yok.</span>'; return; }

    const totalHours = Math.floor(totalMins / 60); const totalRemMins = totalMins % 60;
    const summaryCard = document.createElement('div'); summaryCard.className = 'stat-card';
    summaryCard.innerHTML = `<div class="stat-header"><span>Haftalık Planlanan</span><span class="stat-time">${totalHours}s ${totalRemMins}dk</span></div>`;
    statsContainer.appendChild(summaryCard);

    Object.values(typeTotals).forEach(stat => {
        const h = Math.floor(stat.mins / 60); const m = stat.mins % 60;
        const percentage = Math.round((stat.mins / totalMins) * 100);
        const card = document.createElement('div'); card.className = 'stat-card';
        card.innerHTML = `<div class="stat-header"><span style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:3px; background:${stat.color}"></span>${stat.name}</span><span class="stat-time">${h > 0 ? h+'s ' : ''}${m}dk (%${percentage})</span></div><div class="progress-track"><div class="progress-fill" style="width: 0%; background:${stat.color};"></div></div>`;
        statsContainer.appendChild(card);
        setTimeout(() => card.querySelector('.progress-fill').style.width = `${percentage}%`, 50);
    });
}

function setupModal() {
    const modal = document.getElementById('edit-modal');
    document.getElementById('close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));
    
    document.getElementById('modal-save-btn').addEventListener('click', () => {
        const ev = state.scheduledEvents.find(e => e.id === activeEditingId);
        if (ev) {
            ev.title = document.getElementById('modal-title').value;
            ev.bgColor = document.getElementById('modal-bg-color').value;
            ev.textColor = document.getElementById('modal-text-color').value;
            ev.fontWeight = document.getElementById('modal-font-weight').value;
            ev.desc = document.getElementById('modal-desc').value;
            ev.titleFontSize = document.getElementById('modal-font-size').value; 
            const startMins = timeToMins(document.getElementById('modal-start').value);
            let endMins = timeToMins(document.getElementById('modal-end').value);
            if (endMins <= startMins) endMins = startMins + 15; 
            if (endMins > TOTAL_MINS) endMins = TOTAL_MINS;
            ev.startMin = startMins; ev.duration = endMins - startMins; ev.updatedAt = Date.now();
            saveData(); renderEvents(); updateStats();
        }
        modal.classList.remove('active');
    });

    document.getElementById('modal-delete-btn').addEventListener('click', () => {
        deleteScheduledEvent(activeEditingId); renderEvents(); updateStats(); modal.classList.remove('active');
    });
}

function openModal(id) {
    const ev = state.scheduledEvents.find(e => e.id === id);
    if (!ev) return;
    activeEditingId = id;
    document.getElementById('modal-title').value = ev.title;
    document.getElementById('modal-start').value = minsToTime(ev.startMin);
    document.getElementById('modal-end').value = minsToTime(ev.startMin + ev.duration);
    document.getElementById('modal-bg-color').value = ev.bgColor;
    document.getElementById('modal-text-color').value = ev.textColor || getContrastYIQ(ev.bgColor);
    document.getElementById('modal-font-weight').value = ev.fontWeight || '500';
    document.getElementById('modal-desc').value = ev.desc || '';
    document.getElementById('modal-font-size').value = ev.titleFontSize || 14; 
    document.getElementById('edit-modal').classList.add('active');
}