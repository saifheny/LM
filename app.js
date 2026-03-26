import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, set, get, update, remove, onValue, child }
    from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAjE-2q6PONBkCin9ZN22gDp9Q8pAH9ZW8",
    authDomain: "story-97cf7.firebaseapp.com",
    databaseURL: "https://story-97cf7-default-rtdb.firebaseio.com",
    projectId: "story-97cf7",
    storageBucket: "story-97cf7.firebasestorage.app",
    messagingSenderId: "742801388214",
    appId: "1:742801388214:web:32a305a8057b0582c5ec17",
    measurementId: "G-9DPPWX7CF0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const booksRef = ref(db, 'books');
const settingsRef = ref(db, 'settings');

const CATEGORIES = {
    programming: {
        name: 'برمجة',
        icon: 'fas fa-code',
        image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=75',
        subcategories: {
            python: 'بايثون',
            html: 'HTML',
            css: 'CSS',
            javascript: 'جافاسكريبت',
            concepts: 'مفاهيم البرمجة',
            ai_fundamentals: 'أساسيات الذكاء الاصطناعي'
        }
    },
    ai: {
        name: 'ذكاء اصطناعي',
        icon: 'fas fa-robot',
        image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&q=75',
        subcategories: {
            ai: 'ذكاء اصطناعي',
            ml: 'تعلم الآلة',
            data_analysis: 'تحليل البيانات',
            deep_learning: 'التعلم العميق',
            nlp: 'معالجة اللغات الطبيعية',
            computer_vision: 'الرؤية الحاسوبية'
        }
    },
    stories: {
        name: 'قصص',
        icon: 'fas fa-feather-alt',
        image: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=400&q=75',
        subcategories: {
            novels: 'روايات',
            short_stories: 'قصص قصيرة',
            sci_fi: 'خيال علمي',
            adventure: 'مغامرات',
            fantasy: 'فانتازيا',
            horror: 'رعب'
        }
    },
    general: {
        name: 'عام',
        icon: 'fas fa-globe',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=75',
        subcategories: {
            self_dev: 'تطوير ذاتي',
            science: 'علوم',
            tech: 'تكنولوجيا',
            history: 'تاريخ',
            philosophy: 'فلسفة'
        }
    }
};

const CATEGORY_IMAGES = {
    programming: [
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=75',
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=75',
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=75',
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=75',
        'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&q=75'
    ],
    ai: [
        'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&q=75',
        'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&q=75',
        'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=400&q=75',
        'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&q=75',
        'https://images.unsplash.com/photo-1531746790095-e5a3e5b15090?w=400&q=75'
    ],
    stories: [
        'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=400&q=75',
        'https://images.unsplash.com/photo-1474932430478-367dbb6832c1?w=400&q=75',
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=75',
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=75',
        'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=75'
    ],
    general: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=75',
        'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=75',
        'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?w=400&q=75',
        'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&q=75',
        'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&q=75'
    ]
};

const ICON_DATABASE = {
    programming: [
        'fas fa-code', 'fas fa-laptop-code', 'fas fa-terminal', 'fas fa-database',
        'fas fa-server', 'fas fa-microchip', 'fas fa-network-wired', 'fas fa-code-branch',
        'fas fa-bug', 'fas fa-gear', 'fas fa-gears', 'fas fa-file-code',
        'fab fa-python', 'fab fa-js-square', 'fab fa-html5', 'fab fa-css3-alt',
        'fab fa-react', 'fab fa-node-js', 'fab fa-java', 'fab fa-php',
        'fab fa-git-alt', 'fab fa-github', 'fab fa-docker', 'fab fa-linux',
        'fab fa-android', 'fab fa-apple', 'fab fa-windows', 'fab fa-aws',
        'fas fa-cloud', 'fas fa-shield-halved', 'fas fa-lock', 'fas fa-key',
        'fas fa-plug', 'fas fa-cube', 'fas fa-cubes', 'fas fa-sitemap',
        'fab fa-swift', 'fab fa-rust', 'fab fa-golang', 'fab fa-vuejs'
    ],
    ai: [
        'fas fa-robot', 'fas fa-brain', 'fas fa-microchip', 'fas fa-chart-line',
        'fas fa-chart-bar', 'fas fa-chart-pie', 'fas fa-diagram-project',
        'fas fa-network-wired', 'fas fa-eye', 'fas fa-language',
        'fas fa-wand-magic-sparkles', 'fas fa-atom', 'fas fa-dna',
        'fas fa-microscope', 'fas fa-flask', 'fas fa-calculator',
        'fas fa-square-root-variable', 'fas fa-infinity', 'fas fa-magnifying-glass-chart',
        'fas fa-table-cells', 'fas fa-filter', 'fas fa-bolt', 'fas fa-lightbulb',
        'fas fa-puzzle-piece', 'fas fa-gears', 'fas fa-satellite',
        'fas fa-satellite-dish', 'fas fa-wave-square', 'fas fa-project-diagram',
        'fas fa-share-nodes'
    ],
    books: [
        'fas fa-book', 'fas fa-book-open', 'fas fa-book-reader',
        'fas fa-bookmark', 'fas fa-book-atlas', 'fas fa-book-bible',
        'fas fa-book-journal-whills', 'fas fa-book-medical',
        'fas fa-book-open-reader', 'fas fa-book-quran',
        'fas fa-book-skull', 'fas fa-book-tanakh',
        'fas fa-swatchbook', 'fas fa-scroll', 'fas fa-newspaper',
        'fas fa-file-lines', 'fas fa-file-pdf', 'fas fa-graduation-cap',
        'fas fa-chalkboard-user', 'fas fa-school', 'fas fa-pen-fancy',
        'fas fa-pen-nib', 'fas fa-marker', 'fas fa-highlighter',
        'fas fa-spell-check', 'fas fa-glasses'
    ],
    science: [
        'fas fa-atom', 'fas fa-flask', 'fas fa-vial', 'fas fa-microscope',
        'fas fa-dna', 'fas fa-biohazard', 'fas fa-radiation',
        'fas fa-temperature-half', 'fas fa-magnet', 'fas fa-virus',
        'fas fa-bacteria', 'fas fa-disease', 'fas fa-seedling',
        'fas fa-leaf', 'fas fa-tree', 'fas fa-earth-americas',
        'fas fa-earth-africa', 'fas fa-meteor', 'fas fa-moon',
        'fas fa-sun', 'fas fa-star', 'fas fa-rocket',
        'fas fa-satellite', 'fas fa-shuttle-space', 'fas fa-user-astronaut'
    ],
    design: [
        'fas fa-palette', 'fas fa-paintbrush', 'fas fa-pen-ruler',
        'fas fa-bezier-curve', 'fas fa-vector-square', 'fas fa-crop-simple',
        'fas fa-object-group', 'fas fa-object-ungroup', 'fas fa-layer-group',
        'fas fa-eye-dropper', 'fas fa-fill-drip', 'fas fa-wand-magic',
        'fas fa-image', 'fas fa-camera', 'fas fa-film',
        'fas fa-video', 'fas fa-photo-film', 'fas fa-icons',
        'fas fa-shapes', 'fas fa-draw-polygon', 'fas fa-ruler-combined',
        'fas fa-compass-drafting', 'fas fa-swatchbook', 'fab fa-figma',
        'fab fa-sketch'
    ],
    misc: [
        'fas fa-heart', 'fas fa-star', 'fas fa-fire', 'fas fa-bolt',
        'fas fa-crown', 'fas fa-gem', 'fas fa-trophy', 'fas fa-medal',
        'fas fa-award', 'fas fa-certificate', 'fas fa-shield',
        'fas fa-flag', 'fas fa-bell', 'fas fa-envelope',
        'fas fa-comment', 'fas fa-comments', 'fas fa-message',
        'fas fa-hand-sparkles', 'fas fa-hands-clapping',
        'fas fa-thumbs-up', 'fas fa-face-smile', 'fas fa-music',
        'fas fa-headphones', 'fas fa-gamepad', 'fas fa-chess',
        'fas fa-dice', 'fas fa-puzzle-piece', 'fas fa-compass',
        'fas fa-map', 'fas fa-location-dot', 'fas fa-house',
        'fas fa-building', 'fas fa-city', 'fas fa-mountain-sun',
        'fas fa-water', 'fas fa-umbrella', 'fas fa-snowflake',
        'fas fa-cloud-sun', 'fas fa-rainbow', 'fas fa-plane',
        'fas fa-car', 'fas fa-bicycle', 'fas fa-train',
        'fas fa-ship', 'fas fa-helicopter', 'fas fa-utensils',
        'fas fa-mug-hot', 'fas fa-cookie', 'fas fa-pizza-slice',
        'fas fa-burger'
    ]
};

let allBooks = {};
let globalSettings = {};
let currentView = 'home';
let currentFilter = 'all';
let selectedBooks = new Set();
let adminTapCount = 0;
let adminTapTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initRouter();
    initEventListeners();
    loadBooks();
    loadSettings();
});

// ── Settings & Social Links ────────────────────────────────────
function loadSettings() {
    onValue(settingsRef, (snapshot) => {
        globalSettings = snapshot.val() || {};

        // Populate admin inputs
        const setVal = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.value = globalSettings[key] || '';
        };
        setVal('globalFacebookLink', 'facebookLink');
        setVal('globalLinkedinLink', 'linkedinLink');
        setVal('globalRedditLink',   'redditLink');
        setVal('globalGithubLink',   'githubLink');

        // Update all social icon links across the page
        updateSocialLinks();
    });
}

function updateSocialLinks() {
    const map = [
        { ids: ['footerFbLink', 'aboutFbLink'], key: 'facebookLink'  },
        { ids: ['footerLiLink', 'aboutLiLink'], key: 'linkedinLink'  },
        { ids: ['footerRdLink', 'aboutRdLink'], key: 'redditLink'    },
        { ids: ['footerGhLink', 'aboutGhLink'], key: 'githubLink'    },
    ];
    map.forEach(({ ids, key }) => {
        const href = globalSettings[key];
        if (href) {
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.href = href; el.target = '_blank'; }
            });
        }
    });
}

// ── Particles ─────────────────────────────────────────────────
function initParticles() {
    const canvas = document.getElementById('particlesCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    const count = 30;

    function resize() {
        canvas.width  = Math.min(window.innerWidth, 480);
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size:   Math.random() * 1.5 + 0.3,
            speedX: (Math.random() - 0.5) * 0.2,
            speedY: (Math.random() - 0.5) * 0.2,
            opacity: Math.random() * 0.25 + 0.05
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width)  p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
            ctx.fill();
        });
        particles.forEach((p1, i) => {
            particles.slice(i + 1).forEach(p2 => {
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < 100) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(255,255,255,${0.04 * (1 - dist / 100)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            });
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// ── Router ─────────────────────────────────────────────────────
function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
}

function handleRoute() {
    const hash  = window.location.hash || '#home';
    const parts = hash.split('/');
    const route = parts[0];

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    if (route === '#book' && parts[1]) {
        showBookDetail(parts[1]);
    } else if (route === '#download' && parts[1]) {
        openDownloadPage(parts[1]);
    } else if (route === '#admin') {
        showView('adminView');
    } else if (route === '#privacyPolicy') {
        showView('privacyPolicyView');
    } else if (route === '#howToUse') {
        showView('howToUseView');
    } else if (route === '#terms') {
        showView('termsView');
    } else if (route === '#about') {
        showView('aboutView');
    } else {
        showView('homeView');
    }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
        view.style.animation = 'none';
        void view.offsetHeight;
        view.style.animation = '';
        window.scrollTo(0, 0);
    }
    currentView = viewId === 'homeView'  ? 'home'
                : viewId === 'adminView' ? 'admin'
                : viewId === 'bookDetailView' ? 'detail'
                : viewId;

    const header = document.getElementById('mainHeader');
    header.style.display = viewId === 'homeView' ? '' : 'none';
}

// ── Event Listeners ────────────────────────────────────────────
function initEventListeners() {
    // Logo triple-tap → admin
    document.getElementById('logoArea').addEventListener('click', () => {
        adminTapCount++;
        clearTimeout(adminTapTimer);
        adminTapTimer = setTimeout(() => { adminTapCount = 0; }, 800);
        if (adminTapCount >= 3) {
            adminTapCount = 0;
            window.location.hash = '#admin';
        }
    });

    // Search
    document.getElementById('searchToggle').addEventListener('click', () => {
        const bar = document.getElementById('searchBar');
        bar.classList.toggle('hidden');
        if (!bar.classList.contains('hidden')) {
            document.getElementById('searchInput').focus();
        }
    });

    document.getElementById('searchClose').addEventListener('click', () => {
        document.getElementById('searchBar').classList.add('hidden');
        document.getElementById('searchInput').value = '';
        renderBooks(allBooks);
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) { renderBooks(allBooks); return; }
        const filtered = {};
        Object.entries(allBooks).forEach(([id, book]) => {
            if (book.title?.toLowerCase().includes(query) ||
                book.author?.toLowerCase().includes(query) ||
                book.description?.toLowerCase().includes(query)) {
                filtered[id] = book;
            }
        });
        renderBooks(filtered);
    });

    // Category filters
    document.getElementById('categoryFilters').addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.dataset.category;
        renderBooks(allBooks);
    });

    // Back buttons
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.hash = '#home';
    });
    document.getElementById('adminBackBtn').addEventListener('click', () => {
        window.location.hash = '#home';
    });
    document.getElementById('privacyBackBtn').addEventListener('click', () => {
        window.history.back();
    });
    document.getElementById('howToUseBackBtn').addEventListener('click', () => {
        window.history.back();
    });
    document.getElementById('downloadBackBtn').addEventListener('click', () => {
        window.history.back();
    });
    document.getElementById('downloadDoneClose').addEventListener('click', () => {
        window.history.back();
    });
    document.getElementById('termsBackBtn').addEventListener('click', () => {
        window.history.back();
    });
    document.getElementById('aboutBackBtn').addEventListener('click', () => {
        window.history.back();
    });

    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
            if (tab.dataset.tab === 'myBooks') loadMyBooks();
        });
    });

    // Book form
    document.getElementById('bookCategory').addEventListener('change', (e) => {
        updateSubcategories(e.target.value);
    });

    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
        });
    });

    document.getElementById('iconPickerTrigger').addEventListener('click', openIconPicker);
    document.getElementById('iconPickerClose').addEventListener('click', closeIconPicker);

    document.getElementById('iconCategoryTabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.icon-cat-tab');
        if (!tab) return;
        document.querySelectorAll('.icon-cat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderIcons(tab.dataset.cat);
    });

    document.getElementById('iconSearchInput').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const activeTab = document.querySelector('.icon-cat-tab.active').dataset.cat;
        renderIcons(activeTab, q);
    });

    // Social link save buttons (all 4)
    document.querySelectorAll('.soc-save-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const platform = btn.dataset.platform;
            const inputMap = {
                'facebookLink': 'globalFacebookLink',
                'linkedinLink': 'globalLinkedinLink',
                'redditLink':   'globalRedditLink',
                'githubLink':   'globalGithubLink'
            };
            const inputId = inputMap[platform];
            if (!inputId) return;
            const link = document.getElementById(inputId).value.trim();
            try {
                await set(ref(db, `settings/${platform}`), link);
                showToast('تم الحفظ بنجاح! ✓', 'success');
            } catch (err) {
                showToast('حصل مشكلة: ' + err.message, 'error');
            }
        });
    });

    document.getElementById('bookForm').addEventListener('submit', handleBookSubmit);
    document.getElementById('selectAllBtn').addEventListener('click', toggleSelectAll);
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelected);

    document.getElementById('confirmDeleteNo').addEventListener('click', closeConfirmDelete);

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            document.body.classList.remove('modal-open');
        });
    });
}

// ── Load Books ─────────────────────────────────────────────────
function loadBooks() {
    onValue(booksRef, (snapshot) => {
        allBooks = snapshot.val() || {};
        renderBooks(allBooks);
    });
}

function getBookImage(book, index) {
    const cat    = book.category || 'general';
    const images = CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.general;
    return images[index % images.length];
}

// ── Render Books ───────────────────────────────────────────────
function renderBooks(books) {
    const grid  = document.getElementById('booksGrid');
    const empty = document.getElementById('emptyState');
    grid.innerHTML = '';

    let filtered = Object.entries(books);
    if (currentFilter !== 'all') {
        filtered = filtered.filter(([_, b]) => b.category === currentFilter);
    }

    if (filtered.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    filtered.forEach(([id, book], index) => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.style.animationDelay = `${index * 0.06}s`;
        card.addEventListener('click', () => {
            window.location.hash = `#book/${id}`;
        });

        const catName    = CATEGORIES[book.category]?.name || book.category;
        const coverColor = book.coverColor || '#6C5CE7';
        const bgImage    = getBookImage(book, index);

        card.innerHTML = `
            <div class="book-cover" style="background: linear-gradient(135deg, ${coverColor}, ${adjustColor(coverColor, -30)})">
                <div class="book-cover-image" style="background-image: url('${bgImage}')"></div>
                <span class="book-cover-category">${catName}</span>
                <i class="${book.icon || 'fas fa-book'} book-cover-icon"></i>
                <span class="book-cover-title">${book.title}</span>
                ${book.author ? `<span class="book-card-author">${book.author}</span>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

// ── Book Detail ────────────────────────────────────────────────
function showBookDetail(bookId) {
    showView('bookDetailView');
    const content = document.getElementById('bookDetailContent');

    const book = allBooks[bookId];
    if (!book) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle empty-icon"></i>
                <p>الكتاب ده مش موجود</p>
            </div>
        `;
        return;
    }

    const catName    = CATEGORIES[book.category]?.name || book.category;
    const subCatName = CATEGORIES[book.category]?.subcategories?.[book.subcategory] || book.subcategory || '';
    const coverColor = book.coverColor || '#6C5CE7';
    const siteUrl    = window.location.origin + window.location.pathname;
    const bookLink   = `${siteUrl}#book/${bookId}`;
    const bgImage    = CATEGORIES[book.category]?.image || CATEGORY_IMAGES.general[0];

    content.innerHTML = `
        <div class="book-detail-3d">
            <div class="book-3d-wrapper">
                <div class="book-3d-front" style="background: linear-gradient(135deg, ${coverColor}, ${adjustColor(coverColor, -40)})">
                    <div class="book-3d-bg-image" style="background-image: url('${bgImage}')"></div>
                    <div class="book-3d-overlay"></div>
                    <i class="${book.icon || 'fas fa-book'} book-3d-icon"></i>
                    <span class="book-3d-title">${book.title}</span>
                </div>
                <div class="book-3d-side" style="background: ${adjustColor(coverColor, -50)}"></div>
            </div>
        </div>
        <div class="book-detail-info">
            <h2 class="book-detail-title animate-text">${book.title}</h2>
            ${book.author ? `
                <div class="book-detail-author animate-text delay-1">
                    <i class="fas fa-user-pen"></i> ${book.author}
                </div>
            ` : ''}
            <div class="book-detail-meta animate-text delay-2">
                <span class="meta-tag"><i class="fas fa-folder"></i> ${catName}</span>
                ${subCatName ? `<span class="meta-tag"><i class="fas fa-tag"></i> ${subCatName}</span>` : ''}
            </div>
            ${book.description ? `
                <div class="book-detail-desc animate-text delay-2">${book.description}</div>
            ` : ''}
            <div class="book-detail-actions">
                <button class="action-btn download-action-btn" id="downloadBookBtn">
                    <i class="fas fa-download"></i> تحميل
                </button>
                <button class="action-btn share-action-btn" id="shareBookBtn">
                    <i class="fas fa-share-nodes"></i> مشاركة
                </button>
            </div>
            <div class="book-detail-unique-link">
                <input type="text" readonly value="${bookLink}" id="bookUniqueLink">
                <button id="copyLinkBtn"><i class="fas fa-copy"></i> نسخ</button>
            </div>
        </div>
    `;

    document.getElementById('downloadBookBtn').addEventListener('click', () => {
        window.location.hash = `#download/${bookId}`;
    });

    document.getElementById('shareBookBtn').addEventListener('click', () => {
        shareBook(book, bookLink);
    });

    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        const input = document.getElementById('bookUniqueLink');
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            showToast('تم نسخ اللينك!', 'success');
        }).catch(() => {
            document.execCommand('copy');
            showToast('تم نسخ اللينك!', 'success');
        });
    });
}

function shareBook(book, link) {
    const shareData = {
        title: book.title,
        text: `📚 ${book.title}${book.author ? ' - ' + book.author : ''}\nحمّل الكتاب من هنا:`,
        url: link
    };
    if (navigator.share) {
        navigator.share(shareData).catch(() => {});
    } else {
        navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`).then(() => {
            showToast('تم نسخ رابط المشاركة!', 'success');
        }).catch(() => {
            showToast('مقدرش أنسخ اللينك', 'error');
        });
    }
}

// ── Download Flow ──────────────────────────────────────────────
let currentDownloadBook = null;
let downloadTimerTimeout = null;

/**
 * Helper: show a specific download step and hide all others.
 * Manages both the `active` class (CSS display toggle) and
 * the `hidden` utility class simultaneously.
 */
function showDownloadStep(stepId) {
    document.querySelectorAll('.download-step').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    const step = document.getElementById(stepId);
    if (step) {
        step.classList.remove('hidden');
        step.classList.add('active');
    }
}

function openDownloadPage(bookId) {
    const book = allBooks[bookId];
    if (!book) {
        window.location.hash = '#home';
        return;
    }

    showView('downloadView');
    currentDownloadBook = book;

    // Set Facebook follow link
    const fbLink = globalSettings.facebookLink || '#';
    const fbBtn  = document.getElementById('fbFollowLink');
    fbBtn.href   = fbLink;

    // Clear any previous timer
    if (downloadTimerTimeout) {
        clearTimeout(downloadTimerTimeout);
        downloadTimerTimeout = null;
    }

    // Reset to step 1
    showDownloadStep('downloadStep1');

    // Replace onclick to avoid stacking multiple handlers
    fbBtn.onclick = () => {
        // Step 2: spinner (5-second silent wait)
        showDownloadStep('downloadStep2');

        clearTimeout(downloadTimerTimeout);
        downloadTimerTimeout = setTimeout(() => {
            // Step 3: done + auto-download
            showDownloadStep('downloadStep3');

            if (currentDownloadBook && currentDownloadBook.downloadLink) {
                window.open(currentDownloadBook.downloadLink, '_blank');
            }
        }, 5000);
    };
}

// ── Admin Helpers ──────────────────────────────────────────────
function updateSubcategories(category) {
    const subSelect = document.getElementById('bookSubcategory');
    subSelect.innerHTML = '<option value="">اختار التصنيف الفرعي</option>';
    if (CATEGORIES[category]) {
        Object.entries(CATEGORIES[category].subcategories).forEach(([key, name]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = name;
            subSelect.appendChild(opt);
        });
    }
}

function openIconPicker() {
    document.getElementById('iconPickerModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    document.getElementById('iconSearchInput').value = '';
    document.querySelectorAll('.icon-cat-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.icon-cat-tab[data-cat="all"]').classList.add('active');
    renderIcons('all');
}

function closeIconPicker() {
    document.getElementById('iconPickerModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function renderIcons(category, searchQuery = '') {
    const grid = document.getElementById('iconGrid');
    grid.innerHTML = '';
    const currentIcon = document.getElementById('bookIcon').value;

    let icons = [];
    if (category === 'all') {
        Object.values(ICON_DATABASE).forEach(arr => icons.push(...arr));
        icons = [...new Set(icons)];
    } else {
        icons = ICON_DATABASE[category] || [];
    }

    if (searchQuery) {
        icons = icons.filter(icon => icon.toLowerCase().includes(searchQuery));
    }

    icons.forEach(icon => {
        const item = document.createElement('div');
        item.className = `icon-grid-item${icon === currentIcon ? ' selected' : ''}`;
        item.innerHTML = `<i class="${icon}"></i>`;
        item.addEventListener('click', () => {
            document.getElementById('bookIcon').value = icon;
            document.getElementById('selectedIconPreview').className = icon;
            document.querySelectorAll('.icon-grid-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            closeIconPicker();
        });
        grid.appendChild(item);
    });
}

async function handleBookSubmit(e) {
    e.preventDefault();

    const editId      = document.getElementById('editBookId').value;
    const title       = document.getElementById('bookTitle').value.trim();
    const author      = document.getElementById('bookAuthor').value.trim();
    const description = document.getElementById('bookDescription').value.trim();
    const downloadLink = document.getElementById('bookLink').value.trim();
    const category    = document.getElementById('bookCategory').value;
    const subcategory = document.getElementById('bookSubcategory').value;
    const icon        = document.getElementById('bookIcon').value;
    const coverColor  = document.querySelector('.color-swatch.active')?.dataset.color || '#6C5CE7';

    if (!title || !downloadLink || !category) {
        showToast('كمّل البيانات المطلوبة', 'error');
        return;
    }

    const bookData = {
        title, author, description, downloadLink,
        category, subcategory, icon, coverColor,
        updatedAt: Date.now()
    };

    try {
        if (editId) {
            await update(ref(db, `books/${editId}`), bookData);
            showToast('تم تعديل الكتاب بنجاح!', 'success');
            document.getElementById('editBookId').value = '';
            document.getElementById('submitBtn').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة الكتاب';
        } else {
            bookData.createdAt = Date.now();
            await push(booksRef, bookData);
            showToast('تم إضافة الكتاب بنجاح!', 'success');
        }
        document.getElementById('bookForm').reset();
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        document.querySelector('.color-swatch[data-color="#6C5CE7"]').classList.add('active');
        document.getElementById('bookIcon').value = 'fas fa-book';
        document.getElementById('selectedIconPreview').className = 'fas fa-book';
        document.getElementById('bookSubcategory').innerHTML = '<option value="">اختار التصنيف الفرعي</option>';
    } catch (err) {
        showToast('حصل مشكلة: ' + err.message, 'error');
    }
}

// ── My Books (admin) ───────────────────────────────────────────
function loadMyBooks() {
    const list  = document.getElementById('myBooksList');
    const empty = document.getElementById('myBooksEmpty');
    list.innerHTML = '';
    selectedBooks.clear();
    updateDeleteBtn();

    const entries = Object.entries(allBooks);
    if (entries.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    entries.forEach(([id, book], index) => {
        const item = document.createElement('div');
        item.className = 'my-book-item';
        item.style.animationDelay = `${index * 0.05}s`;
        item.dataset.id = id;

        const catName = CATEGORIES[book.category]?.name || book.category;

        item.innerHTML = `
            <div class="my-book-checkbox" data-id="${id}"></div>
            <div class="my-book-icon" style="background: ${book.coverColor || '#6C5CE7'}">
                <i class="${book.icon || 'fas fa-book'}"></i>
            </div>
            <div class="my-book-info">
                <div class="my-book-title">${book.title}</div>
                <div class="my-book-category">${catName}</div>
            </div>
            <div class="my-book-actions">
                <button class="my-book-action-btn edit" data-id="${id}" title="تعديل">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="my-book-action-btn delete" data-id="${id}" title="حذف">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        item.querySelector('.my-book-checkbox').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleBookSelect(id, item);
        });
        item.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            editBook(id, book);
        });
        item.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDelete([id]);
        });

        list.appendChild(item);
    });
}

function toggleBookSelect(id, item) {
    const checkbox = item.querySelector('.my-book-checkbox');
    if (selectedBooks.has(id)) {
        selectedBooks.delete(id);
        checkbox.classList.remove('checked');
        item.classList.remove('selected');
    } else {
        selectedBooks.add(id);
        checkbox.classList.add('checked');
        item.classList.add('selected');
    }
    updateDeleteBtn();
}

function toggleSelectAll() {
    const items      = document.querySelectorAll('.my-book-item');
    const allSelected = selectedBooks.size === items.length;
    items.forEach(item => {
        const id       = item.dataset.id;
        const checkbox = item.querySelector('.my-book-checkbox');
        if (allSelected) {
            selectedBooks.delete(id);
            checkbox.classList.remove('checked');
            item.classList.remove('selected');
        } else {
            selectedBooks.add(id);
            checkbox.classList.add('checked');
            item.classList.add('selected');
        }
    });
    updateDeleteBtn();
}

function updateDeleteBtn() {
    const btn = document.getElementById('deleteSelectedBtn');
    if (selectedBooks.size > 0) {
        btn.classList.remove('hidden');
        btn.innerHTML = `<i class="fas fa-trash-alt"></i> حذف (${selectedBooks.size})`;
    } else {
        btn.classList.add('hidden');
    }
}

function deleteSelected() {
    if (selectedBooks.size === 0) return;
    confirmDelete([...selectedBooks]);
}

function editBook(id, book) {
    document.getElementById('editBookId').value      = id;
    document.getElementById('bookTitle').value       = book.title       || '';
    document.getElementById('bookAuthor').value      = book.author      || '';
    document.getElementById('bookDescription').value = book.description || '';
    document.getElementById('bookLink').value        = book.downloadLink || '';
    document.getElementById('bookCategory').value   = book.category    || '';
    updateSubcategories(book.category);
    document.getElementById('bookSubcategory').value = book.subcategory || '';
    document.getElementById('bookIcon').value        = book.icon        || 'fas fa-book';
    document.getElementById('selectedIconPreview').className = book.icon || 'fas fa-book';

    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === (book.coverColor || '#6C5CE7'));
    });

    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-pen"></i> تعديل الكتاب';
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.admin-tab[data-tab="addBook"]').classList.add('active');
    document.getElementById('addBookTab').classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('عدّل البيانات واضغط تعديل', 'success');
}

let deleteTargetIds = [];

function confirmDelete(ids) {
    deleteTargetIds = ids;
    const modal = document.getElementById('confirmDeleteModal');
    const msg   = document.getElementById('confirmDeleteMsg');

    if (ids.length === 1) {
        const book = allBooks[ids[0]];
        msg.textContent = `هتحذف "${book?.title || 'الكتاب'}" - الحذف مش هيترجع`;
    } else {
        msg.textContent = `هتحذف ${ids.length} كتب - الحذف مش هيترجع`;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    document.getElementById('confirmDeleteYes').onclick = async () => {
        try {
            const updates = {};
            ids.forEach(id => { updates[`books/${id}`] = null; });
            await update(ref(db), updates);
            showToast(`تم حذف ${ids.length > 1 ? ids.length + ' كتب' : 'الكتاب'} بنجاح`, 'success');
            selectedBooks.clear();
            updateDeleteBtn();
            loadMyBooks();
        } catch (err) {
            showToast('حصل مشكلة في الحذف', 'error');
        }
        closeConfirmDelete();
    };
}

function closeConfirmDelete() {
    document.getElementById('confirmDeleteModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    deleteTargetIds = [];
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    let icon = '';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    if (type === 'error')   icon = '<i class="fas fa-exclamation-circle"></i>';
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icon} ${message}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Utilities ──────────────────────────────────────────────────
function adjustColor(hex, amount) {
    hex = hex.replace('#', '');
    let r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    let g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    let b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
