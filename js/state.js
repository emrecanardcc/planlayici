/* ==========================================================================
   STATE.JS - VERİ VE LOCALSTORAGE YÖNETİMİ
   ========================================================================== */

const defaultEventTypes = [
    { id: 'type_1', name: 'Odaklanma (Deep Work)', color: '#2563eb' },
    { id: 'type_2', name: 'Toplantı / Ders', color: '#10b981' },
    { id: 'type_3', name: 'Mola / Yemek', color: '#f59e0b' },
    { id: 'type_4', name: 'Kitap / Araştırma', color: '#8b5cf6' }
];

export const state = {
    appTitle: localStorage.getItem('planner_title') || "Emre'nin Planlayıcısı",
    eventTypes: JSON.parse(localStorage.getItem('planner_types')) || defaultEventTypes,
    scheduledEvents: JSON.parse(localStorage.getItem('planner_events')) || [],
    theme: localStorage.getItem('planner_theme') || 'light',
    wakeTime: parseInt(localStorage.getItem('planner_wakeTime')) || 0 // Uyanma saati hafızası
};

export function saveData() {
    localStorage.setItem('planner_title', state.appTitle);
    localStorage.setItem('planner_types', JSON.stringify(state.eventTypes));
    localStorage.setItem('planner_events', JSON.stringify(state.scheduledEvents));
    localStorage.setItem('planner_theme', state.theme);
    localStorage.setItem('planner_wakeTime', state.wakeTime);
}

export function addEventType(name, color) {
    const newType = { id: 'typ_' + Date.now(), name: name, color: color };
    state.eventTypes.push(newType);
    saveData();
    return newType;
}

export function addScheduledEvent(eventData) {
    eventData.updatedAt = Date.now(); // Sıralamada üstte kalması için zaman damgası
    state.scheduledEvents.push(eventData);
    saveData();
}

export function deleteScheduledEvent(id) {
    state.scheduledEvents = state.scheduledEvents.filter(e => e.id !== id);
    saveData();
}

export function deleteEventType(id) {
    state.eventTypes = state.eventTypes.filter(t => t.id !== id);
    saveData();
}