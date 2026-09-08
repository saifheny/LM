import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, set, get, onValue } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const booksRef = ref(db, 'books');

// Fixed Author Constraint
const AUTHOR_NAME = "سيف هاني";

// Facebook Follow Link
const FOLLOW_URL = "https://www.facebook.com/share/184852h14r/";

// Default High-Quality Tech Books (Authored by Saif Heny)
const DEFAULT_TECH_BOOKS = [
    {
        title: "المرجع الشامل في لغة بايثون الحديثة",
        category: "programming",
        author: AUTHOR_NAME,
        description: "دليل تقني تفصيلي لتعلم بايثون من الصفر حتى الاحتراف، يشمل هياكل البيانات، البرمجة كائنية التوجه (OOP)، وتطبيقات الذكاء الاصطناعي.",
        coverUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80",
        downloadUrl: "https://drive.google.com",
        downloads: 1420
    },
    {
        title: "هندسة الذكاء الاصطناعي وتعلم الآلة",
        category: "ai",
        author: AUTHOR_NAME,
        description: "شرح معمق لخوارزميات التعلم الآلي، الشبكات العصبية العميقة، وبناء النماذج التوليدية ونماذج اللغات الكبيرة (LLMs).",
        coverUrl: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&q=80",
        downloadUrl: "https://drive.google.com",
        downloads: 2890
    },
    {
        title: "احتراف جافاسكريبت وتايب سكريبت المتطورة",
        category: "web",
        author: AUTHOR_NAME,
        description: "الكتاب الأحدث لفهم محركات الجافاسكريبت V8، البرمجة غير المتزامنة Async/Await، وهندسة تطبيقات الويب التفاعلية الحديثة.",
        coverUrl: "https://images.unsplash.com/photo-1579468118864-ddb850937b4f?w=600&q=80",
        downloadUrl: "https://drive.google.com",
        downloads: 3105
    },
    {
        title: "أساسيات ومفاهيم الأمن السيبراني واختبار الاختراق",
        category: "security",
        author: AUTHOR_NAME,
        description: "مدخل أكاديمي وعملي شامل في حماية الشبكات، تحليل الثغرات الأمنية، التشفير الرقمي، وطرق الحماية الاستباقية للأنظمة.",
        coverUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&q=80",
        downloadUrl: "https://drive.google.com",
        downloads: 1980
    },
    {
        title: "تصميم وإدارة قواعد البيانات السحابية SQL & NoSQL",
        category: "databases",
        author: AUTHOR_NAME,
        description: "شرح شامل لتصميم المخططات المعقدة، تحسين الاستعلامات، والتعامل مع قواعد البيانات الموزعة والحوسبة السحابية الحديثة.",
        coverUrl: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=600&q=80",
        downloadUrl: "https://drive.google.com",
        downloads: 1250
    },
    {
        title: "البرمجة منخفضة المستوى بلغة C++ و Rust",
        category: "programming",
        author: AUTHOR_NAME,
        description: "دليل عملي لإدارة الذاكرة، الأداء الفائق، وبرمجة الأنظمة المدمجة ومحركات الألعاب باحترافية تامة.",
        coverUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=600&q=80",
        downloadUrl: "https://drive.google.com",
        downloads: 1640
    }
];

// App State
let allBooks = [];
let currentCategory = 'all';
let currentSearch = '';
let activeBookForDownload = null;
let verificationTimer = null;
let remainingSeconds = 12;
const TOTAL_WAIT_SECONDS = 12;

// DOM Elements
const booksGrid = document.getElementById('booksGrid');
const booksLoader = document.getElementById('booksLoader');
const emptyState = document.getElementById('emptyState');
const booksCountEl = document.getElementById('booksCount');
const activeCategoryCountEl = document.getElementById('activeCategoryCount');
const globalSearchInput = document.getElementById('globalSearchInput');
const categoryChips = document.getElementById('categoryChips');

// Download Modal Elements
const downloadModal = document.getElementById('downloadModal');
const closeDownloadModalBtn = document.getElementById('closeDownloadModalBtn');
const modalBookThumb = document.getElementById('modalBookThumb');
const modalBookTitle = document.getElementById('modalBookTitle');
const modalBookCategory = document.getElementById('modalBookCategory');

const flowStep1 = document.getElementById('flowStep1');
const flowStep2 = document.getElementById('flowStep2');
const flowStep3 = document.getElementById('flowStep3');

const step1FollowBtn = document.getElementById('step1FollowBtn');
const timerSecondsEl = document.getElementById('timerSeconds');
const countdownBarFill = document.getElementById('countdownBarFill');
const step3DownloadBtn = document.getElementById('step3DownloadBtn');

// Admin Modal Elements
const adminModal = document.getElementById('adminModal');
const openAdminModalBtn = document.getElementById('openAdminModalBtn');
const closeAdminModalBtn = document.getElementById('closeAdminModalBtn');
const addBookForm = document.getElementById('addBookForm');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    listenToBooks();
});

// Setup Events
function setupEventListeners() {
    // Search
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.trim().toLowerCase();
            renderBooks();
        });
    }

    // Keyboard shortcut Ctrl + K
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            globalSearchInput?.focus();
        }
    });

    // Category Filter Chips
    if (categoryChips) {
        categoryChips.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.dataset.cat;
            renderBooks();
        });
    }

    // Admin Modal
    openAdminModalBtn?.addEventListener('click', () => {
        adminModal.style.display = 'flex';
    });

    closeAdminModalBtn?.addEventListener('click', () => {
        adminModal.style.display = 'none';
    });

    // Close Modals on Overlay Click
    window.addEventListener('click', (e) => {
        if (e.target === adminModal) adminModal.style.display = 'none';
        if (e.target === downloadModal) closeDownloadModal();
    });

    // Close Download Modal
    closeDownloadModalBtn?.addEventListener('click', closeDownloadModal);

    // Download Step 1 Action: Follow Page
    step1FollowBtn?.addEventListener('click', () => {
        // Open Facebook page
        window.open(FOLLOW_URL, '_blank');
        
        // Transition directly to Step 2 (Verification)
        startVerificationStep();
    });

    // Add Book Form Submit
    addBookForm?.addEventListener('submit', handleAddBook);
}

// Fetch & Listen to Books
function listenToBooks() {
    onValue(booksRef, (snapshot) => {
        booksLoader.style.display = 'none';
        const data = snapshot.val();
        
        if (!data) {
            // Seed default books if database is empty
            seedDefaultBooks();
            return;
        }

        allBooks = [];
        Object.keys(data).forEach(id => {
            allBooks.push({
                id,
                ...data[id],
                author: AUTHOR_NAME // Enforce Saif Heny as author for all books
            });
        });

        if (booksCountEl) {
            booksCountEl.textContent = allBooks.length;
        }

        renderBooks();
    }, (error) => {
        console.error('Error fetching books:', error);
        booksLoader.style.display = 'none';
        allBooks = DEFAULT_TECH_BOOKS;
        renderBooks();
    });
}

// Seed default books
function seedDefaultBooks() {
    DEFAULT_TECH_BOOKS.forEach(b => {
        push(booksRef, b);
    });
}

// Render Books Grid
function renderBooks() {
    let filtered = allBooks.filter(book => {
        const matchesCategory = currentCategory === 'all' || book.category === currentCategory;
        const matchesSearch = !currentSearch || 
            (book.title && book.title.toLowerCase().includes(currentSearch)) ||
            (book.description && book.description.toLowerCase().includes(currentSearch));
        return matchesCategory && matchesSearch;
    });

    if (activeCategoryCountEl) {
        activeCategoryCountEl.textContent = `(${filtered.length} كتاب)`;
    }

    if (filtered.length === 0) {
        booksGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    booksGrid.innerHTML = filtered.map(book => `
        <div class="book-card" data-id="${book.id}">
            <div class="book-cover-area">
                <img src="${book.coverUrl || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80'}" alt="${book.title}" class="book-cover-img" loading="lazy">
                <span class="book-cat-badge">${getCategoryName(book.category)}</span>
            </div>
            <div class="book-body">
                <h4 class="book-title">${book.title}</h4>
                <div class="book-author-badge">
                    <i class="fas fa-feather-alt"></i>
                    <span>المؤلف: ${AUTHOR_NAME}</span>
                </div>
                <p class="book-description">${book.description || 'كتاب تقني متخصص من إعداد وتأليف سيف هاني.'}</p>
                <div class="book-footer">
                    <span class="book-downloads">
                        <i class="fas fa-arrow-down"></i> ${book.downloads || 150} تحميل
                    </span>
                    <button class="book-download-btn" onclick="window.initiateBookDownload('${book.id}')">
                        <i class="fas fa-download"></i>
                        <span>تحميل الكتاب</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Category Translation Helper
function getCategoryName(cat) {
    const map = {
        programming: 'لغات البرمجة',
        ai: 'الذكاء الاصطناعي',
        web: 'تطوير الويب',
        security: 'الأمن السيبراني',
        databases: 'قواعد البيانات'
    };
    return map[cat] || 'تقنية عامة';
}

// Global hook to initiate download from inline button
window.initiateBookDownload = function(bookId) {
    const book = allBooks.find(b => b.id === bookId) || DEFAULT_TECH_BOOKS[0];
    openDownloadFlow(book);
};

// Open Download Flow Modal (Reset to Step 1)
function openDownloadFlow(book) {
    activeBookForDownload = book;
    
    // Set Header Info
    modalBookTitle.textContent = book.title;
    modalBookCategory.textContent = getCategoryName(book.category);
    modalBookThumb.style.backgroundImage = `url('${book.coverUrl || ''}')`;
    step3DownloadBtn.href = book.downloadUrl || '#';

    // Clear any previous interval
    if (verificationTimer) {
        clearInterval(verificationTimer);
        verificationTimer = null;
    }

    // Strictly show ONLY Step 1
    flowStep1.style.display = 'block';
    flowStep2.style.display = 'none';
    flowStep3.style.display = 'none';

    downloadModal.style.display = 'flex';
}

// Start Verification Step (Step 2)
function startVerificationStep() {
    // Hide Step 1, Show Step 2
    flowStep1.style.display = 'none';
    flowStep2.style.display = 'block';
    flowStep3.style.display = 'none';

    remainingSeconds = TOTAL_WAIT_SECONDS;
    timerSecondsEl.textContent = remainingSeconds;
    countdownBarFill.style.width = '100%';

    if (verificationTimer) clearInterval(verificationTimer);

    verificationTimer = setInterval(() => {
        remainingSeconds--;
        timerSecondsEl.textContent = remainingSeconds;
        
        const percentage = (remainingSeconds / TOTAL_WAIT_SECONDS) * 100;
        countdownBarFill.style.width = percentage + '%';

        if (remainingSeconds <= 0) {
            clearInterval(verificationTimer);
            verificationTimer = null;
            finishVerificationStep();
        }
    }, 1000);
}

// Complete Verification & Unlock Download (Step 3)
function finishVerificationStep() {
    flowStep1.style.display = 'none';
    flowStep2.style.display = 'none';
    flowStep3.style.display = 'block';
}

// Close Modal
function closeDownloadModal() {
    if (verificationTimer) {
        clearInterval(verificationTimer);
        verificationTimer = null;
    }
    downloadModal.style.display = 'none';
}

// Handle Add Book
function handleAddBook(e) {
    e.preventDefault();
    const title = document.getElementById('bookTitle').value.trim();
    const category = document.getElementById('bookCategory').value;
    const description = document.getElementById('bookDesc').value.trim();
    const coverUrl = document.getElementById('bookCoverUrl').value.trim();
    const downloadUrl = document.getElementById('bookDownloadUrl').value.trim();

    if (!title || !downloadUrl) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }

    const newBook = {
        title,
        category,
        author: AUTHOR_NAME, // Strict author
        description,
        coverUrl: coverUrl || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80',
        downloadUrl,
        downloads: 1
    };

    push(booksRef, newBook).then(() => {
        alert('تمت إضافة الكتاب بنجاح تحت اسم المؤلف سيف هاني!');
        addBookForm.reset();
        document.getElementById('bookAuthor').value = AUTHOR_NAME;
        adminModal.style.display = 'none';
    }).catch((err) => {
        console.error('Error adding book:', err);
        alert('حدث خطأ أثناء إضافة الكتاب.');
    });
}
