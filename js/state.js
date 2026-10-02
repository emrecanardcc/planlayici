/* ==========================================================================
   STATE.JS - VERİ VE LOCALSTORAGE YÖNETİMİ
   Uygulamanın durumunu (state) tutar ve tarayıcı belleğine kaydeder.
   ========================================================================== */

// --- VARSAYILAN VERİLER (Kullanıcı ilk kez girdiğinde göreceği şablonlar) ---
const defaultEventTypes = [
    { id: 'type_1', name: 'Odaklanma (Deep Work)', color: '#3b82f6' },
    { id: 'type_2', name: 'Toplantı / Ders', color: '#10b981' },
    { id: 'type_3', name: 'Mola / Yemek', color: '#f59e0b' },
    { id: 'type_4', name: 'Kitap / Araştırma', color: '#8b5cf6' }
];

// --- UYGULAMA VERİLERİ (State) ---
export const state = {
    appTitle: localStorage.getItem('planner_title') || "Emre'nin Haftalık Planı",
    eventTypes: JSON.parse(localStorage.getItem('planner_types')) || defaultEventTypes,
    scheduledEvents: JSON.parse(localStorage.getItem('planner_events')) || [],
    theme: localStorage.getItem('planner_theme') || 'light'
};

// --- VERİ KAYDETME FONKSİYONLARI ---

/** Tüm değişiklikleri tarayıcı belleğine (LocalStorage) yazar. */
export function saveData() {
    localStorage.setItem('planner_title', state.appTitle);
    localStorage.setItem('planner_types', JSON.stringify(state.eventTypes));
    localStorage.setItem('planner_events', JSON.stringify(state.scheduledEvents));
    localStorage.setItem('planner_theme', state.theme);
}

/** Yeni bir şablon (Kütüphane öğesi) ekler */
export function addEventType(name, color) {
    const newType = {
        id: 'typ_' + Date.now(),
        name: name,
        color: color
    };
    state.eventTypes.push(newType);
    saveData();
    return newType;
}

/** Takvime yeni bir etkinlik bloğu ekler */
export function addScheduledEvent(eventData) {
    state.scheduledEvents.push(eventData);
    saveData();
}

/** Takvimdeki bir etkinliği ID'sine göre günceller */
export function updateScheduledEvent(id, updatedData) {
    const index = state.scheduledEvents.findIndex(e => e.id === id);
    if (index !== -1) {
        state.scheduledEvents[index] = { ...state.scheduledEvents[index], ...updatedData };
        saveData();
    }
}

/** Takvimdeki bir etkinliği siler */
export function deleteScheduledEvent(id) {
    state.scheduledEvents = state.scheduledEvents.filter(e => e.id !== id);
    saveData();
}

/** Kütüphaneden bir şablonu siler (Takvimdeki mevcutları etkilemez) */
export function deleteEventType(id) {
    state.eventTypes = state.eventTypes.filter(t => t.id !== id);
    saveData();
}