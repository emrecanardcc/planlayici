/* ==========================================================================
   MAIN.JS - UYGULAMANIN GİRİŞ NOKTASI (ENTRY POINT)
   Tüm modülleri birleştirir ve HTML yüklendiğinde sistemi başlatır.
   ========================================================================== */

import { initUI } from './ui.js';
import { initDragAndDrop } from './dragDrop.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Arayüzü, temayı ve verileri çiz
    initUI();
    
    // 2. Sürükle Bırak ve Fizik Motorunu aktif et
    initDragAndDrop();
    
    console.log("Haftalık Planlayıcı başarıyla başlatıldı!");
});