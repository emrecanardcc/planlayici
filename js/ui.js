/* ==========================================================================
   UI.JS - EKRAN ÇİZİMİ, MODAL YÖNETİMİ, İSTATİSTİKLER VE OTOMASYONLAR
   ========================================================================== */

import { state, saveData, addEventType, deleteEventType, deleteScheduledEvent } from './state.js';
import { calculateOverlaps, PX_PER_MIN, TOTAL_MINS, minsToTime, getContrastYIQ, timeToMins } from './calendar.js';
import { initResize } from './dragDrop.js';

let activeEditingId = null;
let draggedLibraryItem = null; // Kütüphane sıralaması için

export function initUI() {
    // 1. Temayı Ayarla
    document.documentElement.setAttribute('data-theme', state.theme);
    
    // 2. Başlık Ayarları (Düzenlenebilir Başlık)
    const titleEl = document.getElementById('app-title');
    titleEl.innerText = state.appTitle;
    titleEl.addEventListener('blur', () => {
        state.appTitle = titleEl.innerText;
        saveData();
    });

    // 3. Tema Değiştirme Butonu
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', state.theme);
        saveData();
    });

    // 4. PDF Çıktı Butonu
    document.getElementById('pdf-export-btn').addEventListener('click', () => window.print());

    // 5. Yeni Şablon Ekleme
    document.getElementById('add-event-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('new-event-name');
        const colorInput = document.getElementById('new-event-color');
        if (nameInput.value.trim()) {
            addEventType(nameInput.value.trim(), colorInput.value);
            nameInput.value = '';
            renderLibrary();
        }
    });

    // 6. UYKU OTOMASYONU (Sleep Module)
    document.getElementById('apply-sleep-btn').addEventListener('click', () => {
        const startStr = document.getElementById('sleep-start').value;
        const endStr = document.getElementById('sleep-end').value;
        if (!startStr || !endStr) return;

        const startMins = timeToMins(startStr);
        const endMins = timeToMins(endStr);
        const sleepColor = '#1e1b4b'; // Koyu, göz yormayan gece rengi
        const sleepTextColor = '#ffffff';

        // Mevcut uyku etkinliklerini temizle (Tekrar basıldığında üst üste binmemesi için)
        state.scheduledEvents = state.scheduledEvents.filter(e => e.title !== 'Uyku');

        // Haftanın her günü için uyku bloklarını hesapla ve ekle
        for (let day = 0; day < 7; day++) {
            if (startMins < endMins) {
                // Aynı gün içi uyku (Örn: 01:00 - 08:00)
                state.scheduledEvents.push({
                    id: `sleep_${day}_${Date.now()}`,
                    title: 'Uyku', day: day,
                    startMin: startMins, duration: endMins - startMins,
                    bgColor: sleepColor, textColor: sleepTextColor,
                    fontWeight: '500', titleFontSize: 13, desc: ''
                });
            } else {
                // Gece yarısını geçen uyku (Örn: 23:30 - 07:30)
                // Kısım 1: Gece yarısına kadar olan blok (23:30 - 24:00)
                state.scheduledEvents.push({
                    id: `sleep_a_${day}_${Date.now()}`,
                    title: 'Uyku', day: day,
                    startMin: startMins, duration: TOTAL_MINS - startMins,
                    bgColor: sleepColor, textColor: sleepTextColor,
                    fontWeight: '500', titleFontSize: 13, desc: ''
                });
                // Kısım 2: Gece yarısından sabaha kadar olan blok (00:00 - 07:30)
                state.scheduledEvents.push({
                    id: `sleep_b_${day}_${Date.now()}`,
                    title: 'Uyku', day: day,
                    startMin: 0, duration: endMins,
                    bgColor: sleepColor, textColor: sleepTextColor,
                    fontWeight: '500', titleFontSize: 13, desc: ''
                });
            }
        }
        
        saveData();
        renderEvents();
        updateStats();
    });

    // 7. Modal İşlemleri
    setupModal();

    // 8. İlk Çizimleri Yap
    renderLibrary();
    renderGridBase();
    renderEvents();
    updateStats();
}

// === KÜTÜPHANE VE SIRALAMA MANTIĞI ===
export function renderLibrary() {
    const libraryContainer = document.getElementById('event-library');
    libraryContainer.innerHTML = '';

    state.eventTypes.forEach(type => {
        const item = document.createElement('div');
        item.className = 'library-item';
        item.draggable = true;
        item.dataset.typeId = type.id;
        
        item.innerHTML = `
            <span class="library-item-color" style="background:${type.color}"></span>
            <span class="library-item-name">${type.name}</span>
            <div class="library-item-actions">
                <button class="btn btn-icon delete-type-btn" style="color:var(--danger-color); padding:2px;">&times;</button>
            </div>
        `;

        // 1. Silme İşlemi
        item.querySelector('.delete-type-btn').addEventListener('click', (e) => {
            e.stopPropagation(); 
            deleteEventType(type.id);
            renderLibrary();
        });

        // 2. Kütüphane İçi Sürükle-Bırak İle Sıralama (Sortable)
        item.addEventListener('dragstart', (e) => {
            draggedLibraryItem = item;
            // Takvime sürüklemek için gereken data
            e.dataTransfer.setData('application/json', JSON.stringify({ source: 'library', typeId: type.id }));
            setTimeout(() => item.style.opacity = '0.5', 0);
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            draggedLibraryItem = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault(); // Üzerine bırakmaya izin ver
            if (draggedLibraryItem !== item) {
                item.style.transform = 'scale(1.02)';
                item.style.borderColor = 'var(--primary-color)';
            }
        });

        item.addEventListener('dragleave', () => {
            item.style.transform = '';
            item.style.borderColor = '';
        });

        item.addEventListener('drop', (e) => {
            e.stopPropagation();
            item.style.transform = '';
            item.style.borderColor = '';
            
            // Eğer kütüphaneden bir şey kütüphanenin içine bırakıldıysa
            if (draggedLibraryItem && draggedLibraryItem !== item) {
                const srcId = draggedLibraryItem.dataset.typeId;
                const tgtId = item.dataset.typeId;
                
                const srcIndex = state.eventTypes.findIndex(t => t.id === srcId);
                const tgtIndex = state.eventTypes.findIndex(t => t.id === tgtId);
                
                // Dizideki yerlerini değiştir (Reorder Array)
                const [movedType] = state.eventTypes.splice(srcIndex, 1);
                state.eventTypes.splice(tgtIndex, 0, movedType);
                
                saveData();
                renderLibrary();
            }
        });

        libraryContainer.appendChild(item);
    });
}

// === TAKVİM TABANINI ÇİZ ===
export function renderGridBase() {
    const gridBody = document.getElementById('grid-body');
    const heightPx = TOTAL_MINS * PX_PER_MIN;
    
    gridBody.style.height = `${heightPx}px`;

    const timeCol = document.createElement('div');
    timeCol.className = 'time-column';

    for (let h = 0; h <= 24; h++) {
        const yPos = (h * 60) * PX_PER_MIN;
        if (h < 24) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.style.top = `${yPos}px`;
            label.innerText = `${h.toString().padStart(2,'0')}:00`;
            timeCol.appendChild(label);
        }
    }
    gridBody.appendChild(timeCol);

    for (let day = 0; day < 7; day++) {
        const dayCol = document.createElement('div');
        dayCol.className = 'day-column';
        dayCol.dataset.day = day; 
        gridBody.appendChild(dayCol);
    }
}

// === ETKİNLİKLERİ ÇİZ (Overlap Algoritması Burada) ===
export function renderEvents() {
    document.querySelectorAll('.event-block').forEach(el => el.remove());
    const dayCols = document.querySelectorAll('.day-column');

    for (let day = 0; day < 7; day++) {
        const dayCol = dayCols[day];
        if (!dayCol) continue;

        const dayEvents = state.scheduledEvents.filter(e => e.day === day);
        const processedEvents = calculateOverlaps(dayEvents);

        processedEvents.forEach(evt => {
            const block = document.createElement('div');
            block.className = 'event-block';
            block.dataset.id = evt.id;
            block.draggable = true;

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
            const fontSize = evt.titleFontSize || 13;
            
            block.innerHTML = `
                ${showTime ? `<div class="event-time">${startTime} -${endTime}</div>` : ''}
                <div class="event-title" style="font-size: ${fontSize}px;">${evt.title}</div>
                ${evt.desc && showTime ? `<div class="event-desc">${evt.desc}</div>` : ''}
                
                <div class="event-edit-icon" title="Düzenle">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </div>
                
                <div class="resize-handle"></div>
            `;

            block.querySelector('.event-edit-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(evt.id);
            });

            const resizer = block.querySelector('.resize-handle');
            resizer.addEventListener('mousedown', (e) => initResize(e, evt));

            dayCol.appendChild(block);
        });
    }
}

// === İSTATİSTİKLER ===
export function updateStats() {
    const statsContainer = document.getElementById('stats-container');
    statsContainer.innerHTML = '';
    
    let totalMins = 0;
    const typeTotals = {};

    state.scheduledEvents.forEach(e => {
        // Uykuyu toplam plana dahil etmek istemezsen bu if'i açabilirsin:
        // if(e.title === 'Uyku') return; 

        totalMins += e.duration;
        const color = e.bgColor;
        if (!typeTotals[color]) typeTotals[color] = { name: e.title, mins: 0, color: color };
        typeTotals[color].mins += e.duration;
    });

    if (totalMins === 0) {
        statsContainer.innerHTML = '<span style="font-size:13px; color:var(--text-muted);">Henüz planlanmış etkinlik yok.</span>';
        return;
    }

    const totalHours = Math.floor(totalMins / 60);
    const totalRemMins = totalMins % 60;
    
    const summaryCard = document.createElement('div');
    summaryCard.className = 'stat-card';
    summaryCard.innerHTML = `
        <div class="stat-header">
            <span>Haftalık Planlanan</span>
            <span class="stat-time">${totalHours}s ${totalRemMins}dk</span>
        </div>
    `;
    statsContainer.appendChild(summaryCard);

    Object.values(typeTotals).forEach(stat => {
        const h = Math.floor(stat.mins / 60);
        const m = stat.mins % 60;
        const percentage = Math.round((stat.mins / totalMins) * 100);

        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-header">
                <span style="display:flex; align-items:center; gap:6px;">
                    <span style="width:10px; height:10px; border-radius:3px; background:${stat.color}"></span>
                    ${stat.name}
                </span>
                <span class="stat-time">${h > 0 ? h+'s ' : ''}${m}dk (%${percentage})</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width: 0%; background:${stat.color};"></div>
            </div>
        `;
        statsContainer.appendChild(card);

        setTimeout(() => {
            card.querySelector('.progress-fill').style.width = `${percentage}%`;
        }, 50);
    });
}

// === MODAL YÖNETİMİ ===
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

            ev.startMin = startMins;
            ev.duration = endMins - startMins;

            saveData();
            renderEvents();
            updateStats();
        }
        modal.classList.remove('active');
    });

    document.getElementById('modal-delete-btn').addEventListener('click', () => {
        deleteScheduledEvent(activeEditingId);
        renderEvents();
        updateStats();
        modal.classList.remove('active');
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
    document.getElementById('modal-font-size').value = ev.titleFontSize || 13; 

    document.getElementById('edit-modal').classList.add('active');
}