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

// ── التصنيفات التكنولوجية والبرمجية (Tech & Programming Categories) ──
const CATEGORIES = {
    programming: {
        name: 'لغات البرمجة | Programming',
        shortName: 'برمجة • Code',
        icon: 'fas fa-code',
        subcategories: {
            python: 'بايثون (Python)',
            javascript: 'جافا سكريبت وتيب سكريبت (JS & TS)',
            cpp: 'سي بلس بلس (C++)',
            csharp: 'سي شارب و .NET (C#)',
            java: 'جافا (Java)',
            golang: 'جو (Go - Golang)',
            rust: 'رست (Rust)',
            php: 'بي إتش بي (PHP & Laravel)'
        }
    },
    ai: {
        name: 'الذكاء الاصطناعي | AI & ML',
        shortName: 'ذكاء اصطناعي • AI',
        icon: 'fas fa-brain',
        subcategories: {
            machine_learning: 'تعلم الآلة (Machine Learning)',
            deep_learning: 'التعلم العميق (Deep Learning)',
            llms_prompt: 'النماذج التوليدية وهندسة الأوامر (LLMs & Prompts)',
            computer_vision: 'معالجة اللغات ورؤية الحاسوب (NLP & Vision)'
        }
    },
    web: {
        name: 'تطوير الويب | Web Development',
        shortName: 'تطوير ويب • Web',
        icon: 'fas fa-globe',
        subcategories: {
            frontend: 'واجهات أمامية (React & Frontend)',
            backend: 'خوادم وواجهات برمجية (Backend & APIs)',
            fullstack: 'تطوير ويب شامل (Full-Stack)'
        }
    },
    mobile: {
        name: 'تطبيقات الموبايل | Mobile Apps',
        shortName: 'موبايل • Mobile',
        icon: 'fas fa-mobile-screen-button',
        subcategories: {
            flutter: 'فلاتر ودارت (Flutter & Dart)',
            react_native: 'رياكت نيتف (React Native)',
            android_kotlin: 'أندرويد كوتلن (Kotlin)',
            ios_swift: 'آيفون وسويفت (Swift)'
        }
    },
    security: {
        name: 'الأمن السيبراني | Cyber Security',
        shortName: 'أمن سيبراني • Cyber',
        icon: 'fas fa-shield-halved',
        subcategories: {
            ethical_hacking: 'اختبار الاختراق الأخلاقي (Ethical Hacking)',
            network_sec: 'أمن الشبكات وحمايتها (Network Security)',
            web_sec: 'أمان تطبيقات الويب (Web App Security)'
        }
    },
    data: {
        name: 'علم البيانات | Data Science',
        shortName: 'علم البيانات • Data',
        icon: 'fas fa-chart-pie',
        subcategories: {
            data_analysis: 'تحليل البيانات وإحصاء (Data Analysis)',
            databases_sql: 'قواعد البيانات (SQL & Databases)',
            big_data: 'البيانات الضخمة (Big Data)'
        }
    },
    systems: {
        name: 'السيرفرات والسحابية | Cloud & DevOps',
        shortName: 'سيرفرات • DevOps',
        icon: 'fas fa-server',
        subcategories: {
            docker_k8s: 'دوكر وكوبرنيتس (Docker & K8s)',
            linux_admin: 'أنظمة لينكس وخوادم (Linux Admin)',
            aws_cloud: 'الحوسبة السحابية (Cloud & AWS)'
        }
    }
};

// مكتبة الكتب التكنولوجية الافتراضية للمؤلف سيف هاني
const DEFAULT_TECH_BOOKS = {
    "tech-book-01": {
        title: "احترف بايثون من الصفر حتى الاحتراف | Python Masterclass",
        author: "سيف هاني",
        category: "programming",
        subcategory: "python",
        icon: "fab fa-python",
        coverColor: "#2563eb",
        downloadLink: "https://t.me/ThalostaBot?start=iXNSVeZk",
        description: "دليل عملي وتطبيقي شامل لاحتراف لغة بايثون من البدايات الأساسية وهياكل البيانات وحتى البرمجة الكائنية المتقدمة وبناء المشاريع والأتمتة.",
        createdAt: 1787000001000,
        updatedAt: 1787000001000
    },
    "tech-book-02": {
        title: "دليل جافا سكريبت وتطوير الويب الحديث | Modern JS & TS",
        author: "سيف هاني",
        category: "programming",
        subcategory: "javascript",
        icon: "fab fa-js-square",
        coverColor: "#d97706",
        downloadLink: "https://t.me/ThalostaBot?start=7ilfeDjT",
        description: "مرجع متقدم يغطي أحدث معايير JavaScript ES6+، الدوال غير المتزامنة، وهندسة تطبيقات الويب التفاعلية القوية مع TypeScript.",
        createdAt: 1787000002000,
        updatedAt: 1787000002000
    },
    "tech-book-03": {
        title: "البرمجة بلغة C++ وهياكل البيانات | C++ & Data Structures",
        author: "سيف هاني",
        category: "programming",
        subcategory: "cpp",
        icon: "fas fa-laptop-code",
        coverColor: "#0284c7",
        downloadLink: "https://t.me/ThalostaBot?start=ysuvYi3B",
        description: "المرجع التأسيسي الرائد للبرمجة عالية السرعة والكفاءة بلغة C++، إدارة الذاكرة، الخوارزميات، وهياكل البيانات المتقدمة.",
        createdAt: 1787000003000,
        updatedAt: 1787000003000
    },
    "tech-book-04": {
        title: "تطوير التطبيقات بلغة C# و .NET Core | C# Enterprise",
        author: "سيف هاني",
        category: "programming",
        subcategory: "csharp",
        icon: "fas fa-code",
        coverColor: "#7c3aed",
        downloadLink: "https://t.me/ThalostaBot?start=ZeCYLmZ0",
        description: "بناء تطبيقات المؤسسات وقواعد البيانات وواجهات RESTful APIs المتطورة والموثوقة باستخدام لغة سي شارب وبيئة .NET Core.",
        createdAt: 1787000004000,
        updatedAt: 1787000004000
    },
    "tech-book-05": {
        title: "البرمجة الكائنية الشاملة بلغة Java & Spring Boot",
        author: "سيف هاني",
        category: "programming",
        subcategory: "java",
        icon: "fab fa-java",
        coverColor: "#ea580c",
        downloadLink: "https://t.me/ThalostaBot?start=xtLm96UV",
        description: "دليل احترافي لتصميم وهندسة البرمجيات الكائنية OOP بلغة جافا، بناء الخدمات المصغرة Microservices وتطبيقات الويب السحابية.",
        createdAt: 1787000005000,
        updatedAt: 1787000005000
    },
    "tech-book-06": {
        title: "تطوير تطبيقات الموبايل بـ Flutter & Dart",
        author: "سيف هاني",
        category: "mobile",
        subcategory: "flutter",
        icon: "fas fa-mobile-screen-button",
        coverColor: "#0284c7",
        downloadLink: "https://t.me/ThalostaBot?start=xtLm96UV",
        description: "بناء تطبيقات Android و iOS بكود برمجي موحد فائق السرعة، مع تصميم واجهات عصرية وإدارة متقدمة للحالة State Management.",
        createdAt: 1787000006000,
        updatedAt: 1787000006000
    },
    "tech-book-07": {
        title: "هندسة الأنظمة والخدمات بلغة Go (Golang)",
        author: "سيف هاني",
        category: "programming",
        subcategory: "golang",
        icon: "fab fa-golang",
        coverColor: "#00c6ff",
        downloadLink: "https://t.me/ThalostaBot?start=xtLm96UV",
        description: "إتقان البرمجة المتزامنة Concurrency ومعالجة تدفقات البيانات الضخمة وبناء خوادم الويب فائقة الاستجابة بلغة جو من جوجل.",
        createdAt: 1787000007000,
        updatedAt: 1787000007000
    },
    "tech-book-08": {
        title: "البرمجة الآمنة عالية الأداء بلغة Rust",
        author: "سيف هاني",
        category: "programming",
        subcategory: "rust",
        icon: "fab fa-rust",
        coverColor: "#dc2626",
        downloadLink: "https://t.me/ThalostaBot?start=xtLm96UV",
        description: "بناء برمجيات الأنظمة المعقدة بأمان تام في إدارة الذاكرة دون جامع نفايات Memory Safety، مع سرعة تضاهي لغة C و C++.",
        createdAt: 1787000008000,
        updatedAt: 1787000008000
    },
    "tech-book-09": {
        title: "مدخل شامل إلى الذكاء الاصطناعي والتعلم العميق | AI & ML",
        author: "سيف هاني",
        category: "ai",
        subcategory: "deep_learning",
        icon: "fas fa-brain",
        coverColor: "#2563eb",
        downloadLink: "https://t.me/ThalostaBot?start=ExMGDmSE",
        description: "أسس بناء وتدريب الشبكات العصبية، نماذج التعلم العميق، النماذج اللغوية التوليدية LLMs، وتطبيقات الذكاء الاصطناعي الحديثة.",
        createdAt: 1787000009000,
        updatedAt: 1787000009000
    },
    "tech-book-10": {
        title: "الأمن السيبراني واختبار الاختراق الأخلاقي | Ethical Hacking",
        author: "سيف هاني",
        category: "security",
        subcategory: "ethical_hacking",
        icon: "fas fa-shield-halved",
        coverColor: "#059669",
        downloadLink: "https://t.me/ThalostaBot?start=vtQswMzB",
        description: "اكتشاف الثغرات الأمنية، تحليل حزم الشبكات، اختبار اختراق التطبيقات والأنظمة، وتأمين البنية التحتية المعلوماتية.",
        createdAt: 1787000010000,
        updatedAt: 1787000010000
    },
    "tech-book-11": {
        title: "تطوير تطبيقات الويب المتكاملة | Full-Stack Web Development",
        author: "سيف هاني",
        category: "web",
        subcategory: "fullstack",
        icon: "fas fa-globe",
        coverColor: "#0284c7",
        downloadLink: "https://t.me/ThalostaBot?start=aUtPPIuG",
        description: "بناء تطبيقات ويب إنتاجية كاملة من الصفر مع ربط قواعد البيانات وواجهات برمجة التطبيقات ونشرها على خوادم السحابة.",
        createdAt: 1787000011000,
        updatedAt: 1787000011000
    },
    "tech-book-12": {
        title: "علم وتحليل البيانات الضخمة | Data Science & Big Data",
        author: "سيف هاني",
        category: "data",
        subcategory: "data_analysis",
        icon: "fas fa-chart-pie",
        coverColor: "#7c3aed",
        downloadLink: "https://t.me/ThalostaBot?start=ExMGDmSE",
        description: "تحليل البيانات واستخلاص الرؤى، إنشاء المخططات الإحصائية التفاعلية، ومعالجة مجموعات البيانات الكبيرة واستكشاف الأنماط.",
        createdAt: 1787000012000,
        updatedAt: 1787000012000
    }
};

const ICON_DATABASE = {
    programming: [
        'fab fa-python', 'fab fa-js-square', 'fab fa-react', 'fab fa-node-js',
        'fab fa-java', 'fab fa-php', 'fab fa-rust', 'fab fa-golang',
        'fab fa-html5', 'fab fa-css3-alt', 'fab fa-vuejs', 'fab fa-docker',
        'fab fa-git-alt', 'fab fa-github', 'fab fa-linux', 'fab fa-aws',
        'fas fa-code', 'fas fa-laptop-code', 'fas fa-terminal', 'fas fa-database',
        'fas fa-server', 'fas fa-microchip', 'fas fa-network-wired', 'fas fa-code-branch'
    ],
    ai: [
        'fas fa-brain', 'fas fa-robot', 'fas fa-microchip', 'fas fa-diagram-project',
        'fas fa-chart-line', 'fas fa-chart-bar', 'fas fa-chart-pie', 'fas fa-atom',
        'fas fa-wand-magic-sparkles', 'fas fa-dna', 'fas fa-infinity', 'fas fa-bolt'
    ],
    books: [
        'fas fa-book', 'fas fa-book-open', 'fas fa-bookmark', 'fas fa-book-journal-whills',
        'fas fa-file-pdf', 'fas fa-file-code', 'fas fa-scroll', 'fas fa-swatchbook'
    ],
    science: [
        'fas fa-atom', 'fas fa-flask', 'fas fa-microscope', 'fas fa-satellite',
        'fas fa-rocket', 'fas fa-dna', 'fas fa-gear', 'fas fa-gears'
    ],
    design: [
        'fas fa-palette', 'fas fa-paintbrush', 'fas fa-pen-ruler', 'fas fa-bezier-curve',
        'fas fa-layer-group', 'fas fa-crop-simple', 'fab fa-figma'
    ],
    misc: [
        'fas fa-shield-halved', 'fas fa-lock', 'fas fa-key', 'fas fa-cloud',
        'fas fa-star', 'fas fa-fire', 'fas fa-award', 'fas fa-certificate'
    ]
};

let allBooks = {};
let globalSettings = {};
let currentView = 'home';
let currentFilter = 'all';
let selectedBooks = new Set();
let adminTapCount = 0;
let adminTapTimer = null;

// Download countdown timer interval
let downloadTimerInterval = null;
let currentDownloadBook = null;

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

        const setVal = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.value = globalSettings[key] || '';
        };
        setVal('globalFacebookLink', 'facebookLink');
        setVal('globalLinkedinLink', 'linkedinLink');
        setVal('globalRedditLink',   'redditLink');
        setVal('globalGithubLink',   'githubLink');

        updateSocialLinks();
    });
}

function updateSocialLinks() {
    const map = [
        { ids: ['footerFbLink', 'aboutFbLink', 'fbFollowLink'], key: 'facebookLink'  },
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

// ── Particles Canvas (Tech Electric Blue Particles) ────────────
function initParticles() {
    const canvas = document.getElementById('particlesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const count = 28;

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
            size:   Math.random() * 2.2 + 0.8,
            speedX: (Math.random() - 0.5) * 0.25,
            speedY: (Math.random() - 0.5) * 0.25,
            opacity: Math.random() * 0.35 + 0.1
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
            ctx.fillStyle = `rgba(37, 99, 235, ${p.opacity})`;
            ctx.fill();
        });

        // Delicate connecting lines
        particles.forEach((p1, i) => {
            particles.slice(i + 1).forEach(p2 => {
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < 90) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(0, 198, 255, ${0.12 * (1 - dist / 90)})`;
                    ctx.lineWidth = 0.6;
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
    if (header) {
        header.style.display = viewId === 'homeView' ? '' : 'none';
    }
}

// ── Event Listeners ────────────────────────────────────────────
function initEventListeners() {
    // Logo triple-tap → Admin
    const logoArea = document.getElementById('logoArea');
    if (logoArea) {
        logoArea.addEventListener('click', () => {
            adminTapCount++;
            clearTimeout(adminTapTimer);
            adminTapTimer = setTimeout(() => { adminTapCount = 0; }, 800);
            if (adminTapCount >= 3) {
                adminTapCount = 0;
                window.location.hash = '#admin';
            }
        });
    }

    // Search
    const searchToggle = document.getElementById('searchToggle');
    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            const bar = document.getElementById('searchBar');
            bar.classList.toggle('hidden');
            if (!bar.classList.contains('hidden')) {
                document.getElementById('searchInput').focus();
            }
        });
    }

    const searchClose = document.getElementById('searchClose');
    if (searchClose) {
        searchClose.addEventListener('click', () => {
            document.getElementById('searchBar').classList.add('hidden');
            document.getElementById('searchInput').value = '';
            renderBooks(allBooks);
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (!query) { renderBooks(allBooks); return; }
            const filtered = {};
            Object.entries(allBooks).forEach(([id, book]) => {
                if (book.title?.toLowerCase().includes(query) ||
                    (book.author || 'سيف هاني').toLowerCase().includes(query) ||
                    book.description?.toLowerCase().includes(query) ||
                    book.category?.toLowerCase().includes(query) ||
                    book.subcategory?.toLowerCase().includes(query)) {
                    filtered[id] = book;
                }
            });
            renderBooks(filtered);
        });
    }

    // Category filters
    const categoryFilters = document.getElementById('categoryFilters');
    if (categoryFilters) {
        categoryFilters.addEventListener('click', (e) => {
            const pill = e.target.closest('.filter-pill');
            if (!pill) return;
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.dataset.category;
            renderBooks(allBooks);
        });
    }

    // Back buttons
    const bindBack = (id, target) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (target === 'back') window.history.back();
                else window.location.hash = target;
            });
        }
    };
    bindBack('backBtn', '#home');
    bindBack('adminBackBtn', '#home');
    bindBack('privacyBackBtn', 'back');
    bindBack('howToUseBackBtn', 'back');
    bindBack('downloadBackBtn', 'back');
    bindBack('downloadDoneClose', 'back');
    bindBack('termsBackBtn', 'back');
    bindBack('aboutBackBtn', 'back');

    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const content = document.getElementById(tab.dataset.tab + 'Tab');
            if (content) content.classList.add('active');
            if (tab.dataset.tab === 'myBooks') loadMyBooks();
        });
    });

    // Book form category change
    const bookCat = document.getElementById('bookCategory');
    if (bookCat) {
        bookCat.addEventListener('change', (e) => {
            updateSubcategories(e.target.value);
        });
    }

    // Color Swatches
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
        });
    });

    // Icon Picker Modal
    const iconTrigger = document.getElementById('iconPickerTrigger');
    if (iconTrigger) iconTrigger.addEventListener('click', openIconPicker);
    const iconClose = document.getElementById('iconPickerClose');
    if (iconClose) iconClose.addEventListener('click', closeIconPicker);

    const iconTabs = document.getElementById('iconCategoryTabs');
    if (iconTabs) {
        iconTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.icon-cat-tab');
            if (!tab) return;
            document.querySelectorAll('.icon-cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderIcons(tab.dataset.cat);
        });
    }

    const iconSearch = document.getElementById('iconSearchInput');
    if (iconSearch) {
        iconSearch.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const activeTab = document.querySelector('.icon-cat-tab.active')?.dataset.cat || 'all';
            renderIcons(activeTab, q);
        });
    }

    // Social link save buttons
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
                showToast('تم حفظ الرابط بنجاح! ✓', 'success');
            } catch (err) {
                showToast('حدث خطأ أثناء الحفظ: ' + err.message, 'error');
            }
        });
    });

    // Book Form Submit
    const bookForm = document.getElementById('bookForm');
    if (bookForm) bookForm.addEventListener('submit', handleBookSubmit);

    // My Books controls
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) selectAllBtn.addEventListener('click', toggleSelectAll);

    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelected);

    const seedTechBooksBtn = document.getElementById('seedTechBooksBtn');
    if (seedTechBooksBtn) seedTechBooksBtn.addEventListener('click', seedTechBooksToFirebase);

    const confirmNo = document.getElementById('confirmDeleteNo');
    if (confirmNo) confirmNo.addEventListener('click', closeConfirmDelete);

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
        const val = snapshot.val();
        if (val && Object.keys(val).length > 0) {
            allBooks = val;
        } else {
            // Fallback to rich default tech books collection if database is empty
            allBooks = DEFAULT_TECH_BOOKS;
        }
        renderBooks(allBooks);
    }, (error) => {
        console.warn('Firebase error, using default tech catalog:', error);
        allBooks = DEFAULT_TECH_BOOKS;
        renderBooks(allBooks);
    });
}

// ── زر تحديث الفايربيز بكتب التكنولوجيا لسيف هاني ──────────────
async function seedTechBooksToFirebase() {
    try {
        await set(booksRef, DEFAULT_TECH_BOOKS);
        showToast('تم تحديث الفايربيز بكتب التكنولوجيا لسيف هاني بنجاح! 🚀', 'success');
        loadMyBooks();
    } catch (err) {
        showToast('حدث خطأ في تحديث قاعدة البيانات: ' + err.message, 'error');
    }
}

// ── Render Books (تصميم الكتب الحقيقية ثلاثية الأبعاد) ─────────
function renderBooks(books) {
    const grid  = document.getElementById('booksGrid');
    const empty = document.getElementById('emptyState');
    if (!grid) return;
    grid.innerHTML = '';

    let filtered = Object.entries(books);
    if (currentFilter !== 'all') {
        filtered = filtered.filter(([_, b]) => {
            // Support modern tech categories
            return b.category === currentFilter;
        });
    }

    if (filtered.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    filtered.forEach(([id, book], index) => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.style.animationDelay = `${index * 0.05}s`;
        card.addEventListener('click', () => {
            window.location.hash = `#book/${id}`;
        });

        const catData    = CATEGORIES[book.category] || { shortName: 'برمجة • Tech', icon: 'fas fa-laptop-code' };
        const catName    = catData.shortName || book.category;
        const coverColor = book.coverColor || '#2563eb';
        const authorName = book.author || 'سيف هاني';
        const bookIcon   = book.icon || catData.icon || 'fab fa-python';

        // تصميم الغلاف الحقيقي مع كعب الكتاب وسمك الصفحات وشعار لغة البرمجة والمؤلف سيف هاني
        card.innerHTML = `
            <div class="book-card-edge"></div>
            <div class="real-book" style="background: linear-gradient(145deg, ${coverColor} 0%, ${adjustColor(coverColor, -35)} 100%)">
                <div class="book-cover-gloss"></div>
                
                <div class="book-cover-top">
                    <span class="book-tag-pill">${catName}</span>
                    <span class="book-format-badge">PDF</span>
                </div>

                <div class="book-avatar-center">
                    <div class="book-tech-avatar" style="color: ${coverColor}">
                        <i class="${bookIcon}"></i>
                    </div>
                </div>

                <div class="book-cover-bottom">
                    <h3 class="book-card-title">${book.title}</h3>
                    <div class="book-author-badge">
                        <i class="fas fa-user-pen"></i>
                        <span>${authorName}</span>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ── Book Detail ────────────────────────────────────────────────
function showBookDetail(bookId) {
    showView('bookDetailView');
    const content = document.getElementById('bookDetailContent');
    if (!content) return;

    const book = allBooks[bookId] || DEFAULT_TECH_BOOKS[bookId];
    if (!book) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle empty-icon"></i>
                <p>الكتاب ده مش موجود في المكتبة</p>
            </div>
        `;
        return;
    }

    const catData    = CATEGORIES[book.category] || { name: 'كتب البرمجة والتكنولوجيا', icon: 'fas fa-code' };
    const catName    = catData.name || book.category;
    const subCatName = catData.subcategories?.[book.subcategory] || book.subcategory || '';
    const coverColor = book.coverColor || '#2563eb';
    const siteUrl    = window.location.origin + window.location.pathname;
    const bookLink   = `${siteUrl}#book/${bookId}`;
    const authorName = book.author || 'سيف هاني';
    const bookIcon   = book.icon || 'fab fa-python';

    content.innerHTML = `
        <div class="book-detail-3d">
            <div class="book-3d-wrapper">
                <div class="book-3d-front" style="background: linear-gradient(135deg, ${coverColor} 0%, ${adjustColor(coverColor, -40)} 100%)">
                    <div class="book-cover-gloss"></div>
                    <div class="book-3d-icon">
                        <i class="${bookIcon}"></i>
                    </div>
                    <span class="book-3d-title">${book.title}</span>
                    <div class="book-author-badge" style="margin-bottom: 8px;">
                        <i class="fas fa-user-pen"></i>
                        <span>${authorName}</span>
                    </div>
                </div>
                <div class="book-3d-side" style="background: ${adjustColor(coverColor, -55)}"></div>
            </div>
        </div>
        <div class="book-detail-info">
            <h2 class="book-detail-title animate-text">${book.title}</h2>
            <div class="book-detail-author animate-text delay-1">
                <i class="fas fa-user-pen"></i>
                <span>المؤلف: ${authorName}</span>
            </div>
            <div class="book-detail-meta animate-text delay-2">
                <span class="meta-tag"><i class="fas fa-folder"></i> ${catName}</span>
                ${subCatName ? `<span class="meta-tag"><i class="fas fa-tag"></i> ${subCatName}</span>` : ''}
                <span class="meta-tag"><i class="fas fa-file-pdf"></i> نسخة إلكترونية PDF أصلية</span>
            </div>
            ${book.description ? `
                <div class="book-detail-desc animate-text delay-2">${book.description}</div>
            ` : ''}
            <div class="book-detail-actions">
                <button class="action-btn download-action-btn" id="downloadBookBtn">
                    <i class="fas fa-cloud-arrow-down"></i> تحميل الكتاب PDF
                </button>
                <button class="action-btn share-action-btn" id="shareBookBtn">
                    <i class="fas fa-share-nodes"></i> مشاركة
                </button>
            </div>
            <div class="book-detail-unique-link">
                <input type="text" readonly value="${bookLink}" id="bookUniqueLink">
                <button id="copyLinkBtn"><i class="fas fa-copy"></i> نسخ الرابط</button>
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
            showToast('تم نسخ الرابط بنجاح! ✓', 'success');
        }).catch(() => {
            document.execCommand('copy');
            showToast('تم نسخ الرابط بنجاح! ✓', 'success');
        });
    });
}

function shareBook(book, link) {
    const authorName = book.author || 'سيف هاني';
    const shareData = {
        title: book.title,
        text: `📚 ${book.title} - المؤلف: ${authorName}\nاحصل على نسختك من مكتبة سيف هاني التكنولوجية:`,
        url: link
    };
    if (navigator.share) {
        navigator.share(shareData).catch(() => {});
    } else {
        navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`).then(() => {
            showToast('تم نسخ رابط المشاركة!', 'success');
        }).catch(() => {
            showToast('تعذر نسخ الرابط', 'error');
        });
    }
}

// ── نظام التحميل الذكي مع مؤقت متابعة فيسبوك (Smart Download & FB Timer) ──
function openDownloadPage(bookId) {
    const book = allBooks[bookId] || DEFAULT_TECH_BOOKS[bookId];
    if (!book) {
        window.location.hash = '#home';
        return;
    }

    showView('downloadView');
    currentDownloadBook = book;

    // إعداد معلومات الكتاب في رأس بطاقة التحميل
    const thumb = document.getElementById('downloadBookThumb');
    if (thumb) {
        thumb.style.background = book.coverColor || '#2563eb';
    }
    const icon = document.getElementById('downloadBookIcon');
    if (icon) {
        icon.className = book.icon || 'fab fa-python';
    }
    const title = document.getElementById('downloadBookTitle');
    if (title) {
        title.textContent = book.title;
    }
    const author = document.getElementById('downloadBookAuthor');
    if (author) {
        author.innerHTML = `<i class="fas fa-user-pen"></i> ${book.author || 'سيف هاني'}`;
    }

    // إعداد رابط فيسبوك الرسمي
    const fbLink = globalSettings.facebookLink || 'https://www.facebook.com/share/1LjJ8MRs2Q/';
    const fbFollowBtn = document.getElementById('fbFollowLink');
    if (fbFollowBtn) {
        fbFollowBtn.href = fbLink;
    }

    // إظهار خطوة الانتظار والمؤقت وإخفاء زر التنزيل في البداية
    const waitingStep = document.getElementById('downloadWaitingStep');
    const readyStep = document.getElementById('downloadReadyStep');
    if (waitingStep) {
        waitingStep.classList.remove('hidden');
        waitingStep.classList.add('active');
    }
    if (readyStep) {
        readyStep.classList.add('hidden');
        readyStep.classList.remove('active');
    }

    // تجهيز رابط زر التحميل فائق الجاذبية
    const directBtn = document.getElementById('directDownloadBtn');
    if (directBtn) {
        directBtn.href = currentDownloadBook.downloadLink || '#';
        directBtn.onclick = (e) => {
            if (!currentDownloadBook.downloadLink) {
                e.preventDefault();
                showToast('رابط التحميل غير متاح حالياً', 'error');
                return;
            }
            showToast('جاري بدء التحميل الآن... نتمنى لك قراءة ممتعة! 📖', 'success');
        };
    }

    // بدء المؤقت التنازلي التلقائي (8 ثوانٍ)
    startDownloadCountdown(8);
}

function startDownloadCountdown(totalSeconds = 8) {
    clearInterval(downloadTimerInterval);

    let remaining = totalSeconds;
    const timerNum = document.getElementById('countdownTimer');
    const ring = document.getElementById('countdownRing');
    const totalCircumference = 264; // 2 * PI * 42

    if (timerNum) timerNum.textContent = remaining;
    if (ring) {
        ring.style.strokeDasharray = totalCircumference;
        ring.style.strokeDashoffset = 0;
    }

    downloadTimerInterval = setInterval(() => {
        remaining--;
        if (timerNum) timerNum.textContent = remaining;

        if (ring) {
            const offset = totalCircumference * (1 - remaining / totalSeconds);
            ring.style.strokeDashoffset = offset;
        }

        if (remaining <= 0) {
            clearInterval(downloadTimerInterval);
            unlockDownloadButton();
        }
    }, 1000);
}

function unlockDownloadButton() {
    const waitingStep = document.getElementById('downloadWaitingStep');
    const readyStep = document.getElementById('downloadReadyStep');

    if (waitingStep) {
        waitingStep.classList.add('hidden');
        waitingStep.classList.remove('active');
    }
    if (readyStep) {
        readyStep.classList.remove('hidden');
        readyStep.classList.add('active');
    }
    showToast('تم فتح رابط التحميل المباشر بنجاح! ✓', 'success');
}

// ── Admin Helpers ──────────────────────────────────────────────
function updateSubcategories(category) {
    const subSelect = document.getElementById('bookSubcategory');
    if (!subSelect) return;
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
    const modal = document.getElementById('iconPickerModal');
    if (modal) modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    const search = document.getElementById('iconSearchInput');
    if (search) search.value = '';
    document.querySelectorAll('.icon-cat-tab').forEach(t => t.classList.remove('active'));
    const allTab = document.querySelector('.icon-cat-tab[data-cat="all"]');
    if (allTab) allTab.classList.add('active');
    renderIcons('all');
}

function closeIconPicker() {
    const modal = document.getElementById('iconPickerModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function renderIcons(category, searchQuery = '') {
    const grid = document.getElementById('iconGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const currentIcon = document.getElementById('bookIcon')?.value;

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

    const editId       = document.getElementById('editBookId').value;
    const title        = document.getElementById('bookTitle').value.trim();
    const author       = document.getElementById('bookAuthor').value.trim() || 'سيف هاني';
    const description  = document.getElementById('bookDescription').value.trim();
    const downloadLink = document.getElementById('bookLink').value.trim();
    const category     = document.getElementById('bookCategory').value;
    const subcategory  = document.getElementById('bookSubcategory').value;
    const icon         = document.getElementById('bookIcon').value || 'fab fa-python';
    const coverColor   = document.querySelector('.color-swatch.active')?.dataset.color || '#2563eb';

    if (!title || !downloadLink || !category) {
        showToast('يرجى إكمال البيانات المطلوبة', 'error');
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
        document.getElementById('bookAuthor').value = 'سيف هاني';
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        document.querySelector('.color-swatch[data-color="#2563eb"]')?.classList.add('active');
        document.getElementById('bookIcon').value = 'fab fa-python';
        document.getElementById('selectedIconPreview').className = 'fab fa-python';
        document.getElementById('bookSubcategory').innerHTML = '<option value="">اختار التصنيف الفرعي</option>';
    } catch (err) {
        showToast('حدث خطأ: ' + err.message, 'error');
    }
}

// ── My Books (Admin Tab) ───────────────────────────────────────
function loadMyBooks() {
    const list  = document.getElementById('myBooksList');
    const empty = document.getElementById('myBooksEmpty');
    if (!list) return;
    list.innerHTML = '';
    selectedBooks.clear();
    updateDeleteBtn();

    const entries = Object.entries(allBooks);
    if (entries.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    entries.forEach(([id, book], index) => {
        const item = document.createElement('div');
        item.className = 'my-book-item';
        item.style.animationDelay = `${index * 0.04}s`;
        item.dataset.id = id;

        const catData = CATEGORIES[book.category] || { name: book.category || 'عام' };
        const catName = catData.name || book.category;

        item.innerHTML = `
            <div class="my-book-checkbox" data-id="${id}"></div>
            <div class="my-book-icon" style="background: ${book.coverColor || '#2563eb'}">
                <i class="${book.icon || 'fab fa-python'}"></i>
            </div>
            <div class="my-book-info">
                <div class="my-book-title">${book.title}</div>
                <div class="my-book-category">${catName} • ${book.author || 'سيف هاني'}</div>
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
    const items       = document.querySelectorAll('.my-book-item');
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
    if (!btn) return;
    if (selectedBooks.size > 0) {
        btn.classList.remove('hidden');
        btn.innerHTML = `<i class="fas fa-trash-alt"></i> حذف المحدد (${selectedBooks.size})`;
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
    document.getElementById('bookAuthor').value      = book.author      || 'سيف هاني';
    document.getElementById('bookDescription').value = book.description || '';
    document.getElementById('bookLink').value        = book.downloadLink || '';
    document.getElementById('bookCategory').value    = book.category    || '';
    updateSubcategories(book.category);
    document.getElementById('bookSubcategory').value = book.subcategory || '';
    document.getElementById('bookIcon').value        = book.icon        || 'fab fa-python';
    document.getElementById('selectedIconPreview').className = book.icon || 'fab fa-python';

    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === (book.coverColor || '#2563eb'));
    });

    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-pen"></i> حفظ تعديلات الكتاب';
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.admin-tab[data-tab="addBook"]').classList.add('active');
    document.getElementById('addBookTab').classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('تم تحميل بيانات الكتاب للتعديل', 'success');
}

let deleteTargetIds = [];

function confirmDelete(ids) {
    deleteTargetIds = ids;
    const modal = document.getElementById('confirmDeleteModal');
    const msg   = document.getElementById('confirmDeleteMsg');

    if (ids.length === 1) {
        const book = allBooks[ids[0]];
        msg.textContent = `هل أنت متأكد من حذف "${book?.title || 'الكتاب'}"؟`;
    } else {
        msg.textContent = `هل أنت متأكد من حذف ${ids.length} كتب؟`;
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
            showToast('حدث خطأ أثناء الحذف', 'error');
        }
        closeConfirmDelete();
    };
}

function closeConfirmDelete() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    deleteTargetIds = [];
}

// ── Toast Notifications ────────────────────────────────────────
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    let icon = '';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    if (type === 'error')   icon = '<i class="fas fa-exclamation-circle"></i>';
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icon} ${message}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
}

// ── Helpers ────────────────────────────────────────────────────
function adjustColor(hex, amount) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    let r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    let g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    let b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
