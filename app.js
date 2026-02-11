import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyCxNP8BMqvl9NPPUKLORt_jSSmfWBQjmbk",
    authDomain: "to-do-df942.firebaseapp.com",
    projectId: "to-do-df942",
    storageBucket: "to-do-df942.firebasestorage.app",
    messagingSenderId: "996255947966",
    appId: "1:996255947966:web:73b3049dc43f7a456e12ef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const todoInput = document.getElementById('todoInput');
const todoDate = document.getElementById('todoDate');
const todoPriority = document.getElementById('todoPriority');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const filterBtns = document.querySelectorAll('.filter-btn');

const emptyState = document.getElementById('emptyState');
const userBar = document.getElementById('userBar');
const authBtn = document.getElementById('authBtn');
const authModal = document.getElementById('authModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const modalTitle = document.getElementById('modalTitle');
const modalSubmitBtn = document.getElementById('modalSubmitBtn');
const authSwitchText = document.getElementById('authSwitchText');
const authSwitchLink = document.getElementById('authSwitchLink');

// State
let todos = [];
let notes = [];
let currentFilter = 'all';
let currentView = 'todo'; // 'todo' | 'notes'
let currentNoteId = null;
let currentUser = null;
let unsubscribeFirestore = null; // To stop listening when logging out
let unsubscribeNotes = null;

const authError = document.getElementById('authError');

// --- AUTH UI LOGIC ---

let isLoginMode = true;

authBtn.addEventListener('click', () => {
    if (currentUser) {
        signOut(auth).then(() => {
            console.log("Logged out");
        }).catch((error) => {
            console.error("Logout error", error);
        });
    } else {
        openModal();
    }
});

closeModalBtn.addEventListener('click', closeModal);
authSwitchLink.addEventListener('click', toggleAuthMode);

function openModal() {
    authModal.classList.remove('hidden');
    todoInput.blur(); // Remove focus from main input
    authError.textContent = ''; // Clear errors
}

function closeModal() {
    authModal.classList.add('hidden');
    authForm.reset();
    authError.textContent = '';
    isLoginMode = true;
    updateModalUI();
}

function toggleAuthMode(e) {
    if (e) e.preventDefault();
    isLoginMode = !isLoginMode;
    authError.textContent = '';
    updateModalUI();
}

function updateModalUI() {
    if (isLoginMode) {
        modalTitle.textContent = "Welcome Back";
        modalSubmitBtn.textContent = "Login";
        authSwitchText.textContent = "Don't have an account?";
        authSwitchLink.textContent = "Sign up";
    } else {
        modalTitle.textContent = "Create Account";
        modalSubmitBtn.textContent = "Sign Up";
        authSwitchText.textContent = "Already have an account?";
        authSwitchLink.textContent = "Login";
    }
}

authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = authEmail.value;
    const password = authPassword.value;
    authError.textContent = ''; // Clear previous errors

    if (isLoginMode) {
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                closeModal();
            })
            .catch((error) => {
                console.error("Login failed", error);
                let msg = "Login failed. Check your email/password.";
                if (error.code === 'auth/invalid-credential') msg = "Invalid email or password.";
                if (error.code === 'auth/too-many-requests') msg = "Too many attempts. Try again later.";
                authError.textContent = msg;
            });
    } else {
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                closeModal();
            })
            .catch((error) => {
                console.error("Signup failed", error);
                let msg = "Signup failed. " + error.message;
                if (error.code === 'auth/email-already-in-use') msg = "Email already in use.";
                if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
                authError.textContent = msg;
            });
    }
});

// --- AUTH STATE OBSERVER ---

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        // User is signed in
        const userEmailSpan = userBar.querySelector('.user-email');
        if (userEmailSpan) userEmailSpan.textContent = user.email;
        authBtn.textContent = "Logout";
        loadTodosFromFirestore();
        loadNotesFromFirestore();
    } else {
        // User is signed out
        const userEmailSpan = userBar.querySelector('.user-email');
        if (userEmailSpan) userEmailSpan.textContent = "Guest Mode";
        authBtn.textContent = "Login / Signup";
        if (unsubscribeFirestore) {
            unsubscribeFirestore();
            unsubscribeFirestore = null;
        }
        if (unsubscribeNotes) {
            unsubscribeNotes();
            unsubscribeNotes = null;
        }
        loadTodosFromLocal();
        loadNotesFromLocal();
    }
});

// --- TODO LOGIC (Unified) ---

function loadTodosFromLocal() {
    const storedTodos = localStorage.getItem('todos');
    todos = storedTodos ? JSON.parse(storedTodos) : [];
    renderTodos();
}

function loadNotesFromLocal() {
    const storedNotes = localStorage.getItem('notes');
    notes = storedNotes ? JSON.parse(storedNotes) : [];
    renderNotes();
}

function saveTodos() {
    if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        setDoc(userDocRef, { todos: todos }, { merge: true })
            .catch((error) => console.error("Error saving todos:", error));
    } else {
        localStorage.setItem('todos', JSON.stringify(todos));
    }
}

function saveNotes() {
    if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        setDoc(userDocRef, { notes: notes }, { merge: true })
            .catch((error) => console.error("Error saving notes:", error));
    } else {
        localStorage.setItem('notes', JSON.stringify(notes));
    }
}

function loadTodosFromFirestore() {
    const userDocRef = doc(db, "users", currentUser.uid);
    unsubscribeFirestore = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            todos = doc.data().todos || [];
            renderTodos();
        } else {
            todos = [];
            renderTodos();
        }
    });
}

function loadNotesFromFirestore() {
    const userDocRef = doc(db, "users", currentUser.uid);
    unsubscribeNotes = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            notes = doc.data().notes || [];
            renderNotes();
        } else {
            notes = [];
            renderNotes();
        }
    });
}

// Helper: detect mobile/touch devices
function isMobileDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;
}

function addTodo() {
    const text = todoInput.value.trim();
    const date = todoDate.value;
    const priority = todoPriority.value;

    if (text) {
        const newTodo = {
            id: Date.now(),
            text: text,
            dueDate: date,
            priority: priority,
            completed: false,
            createdAt: new Date().toISOString()
        };
        todos.unshift(newTodo); // Add to top
        saveTodos();
        renderTodos();

        // Reset Inputs
        todoInput.value = '';

        // On mobile: blur to dismiss keyboard; on desktop: keep focus for rapid entry
        if (isMobileDevice()) {
            todoInput.blur();
        } else {
            todoInput.focus();
        }
    }
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const willComplete = !todo.completed;

    if (willComplete && currentFilter === 'all') {
        // Animate out, then update
        const li = todoList.querySelector(`[data-id="${id}"]`);
        if (li) {
            li.classList.add('completing');
            setTimeout(() => {
                todos = todos.map(t => t.id === id ? { ...t, completed: true } : t);
                saveTodos();
                renderTodos();
            }, 800);
            return;
        }
    }

    // Uncompleting or toggling in other filters — instant
    todos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTodos();
    renderTodos();
}

function deleteTodo(id, liElement) {
    if (liElement) {
        liElement.classList.add('removing');
        liElement.addEventListener('animationend', () => {
            todos = todos.filter(todo => todo.id !== id);
            saveTodos();
            renderTodos();
        });
    } else {
        todos = todos.filter(todo => todo.id !== id);
        saveTodos();
        renderTodos();
    }
}

// Edit Todo (Advanced Full Row)
window.editTodo = function (id, textSpan) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const li = textSpan.closest('li');
    const originalContent = li.innerHTML;
    const originalClass = li.className;

    li.classList.add('editing');
    li.innerHTML = `
        <div class="edit-form">
            <input type="text" class="edit-input-text" value="${escapeHtml(todo.text)}" placeholder="Task name">
            <div class="edit-meta-group">
                <input type="date" class="edit-input-date" value="${todo.dueDate || ''}">
                <select class="edit-input-priority">
                    <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>Low</option>
                    <option value="medium" ${todo.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>High</option>
                </select>
            </div>
            <div class="edit-actions">
                <button class="save-btn" aria-label="Save">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <button class="cancel-btn" aria-label="Cancel">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
    `;

    const nameInput = li.querySelector('.edit-input-text');
    const dateInput = li.querySelector('.edit-input-date');
    const priorityInput = li.querySelector('.edit-input-priority');
    const saveBtn = li.querySelector('.save-btn');
    const cancelBtn = li.querySelector('.cancel-btn');

    nameInput.focus();

    function save() {
        const newText = nameInput.value.trim();
        const newDate = dateInput.value;
        const newPriority = priorityInput.value;

        if (newText) {
            todos = todos.map(t => t.id === id ? {
                ...t,
                text: newText,
                dueDate: newDate,
                priority: newPriority
            } : t);
            saveTodos();
            renderTodos();
        }
    }

    function cancel() {
        li.className = originalClass;
        li.innerHTML = originalContent;
        // Re-attach listeners since we blew away the innerHTML
        attachItemListeners(li, todo);
    }

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', cancel);

    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') save();
    });
}

function attachItemListeners(li, todo) {
    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const editBtn = li.querySelector('.edit-btn');
    const textSpan = li.querySelector('.todo-text');

    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editTodo(todo.id, textSpan);
    });

    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTodo(todo.id, li);
    });

    textSpan.addEventListener('dblclick', () => editTodo(todo.id, textSpan));
}



// Render Logic
function renderTodos() {
    todoList.innerHTML = '';

    let filteredTodos = todos;
    if (currentFilter === 'all') {
        filteredTodos = todos.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
        filteredTodos = todos.filter(t => t.completed);
    }

    // Update completed count badge on the filter button
    const completedCount = todos.filter(t => t.completed).length;
    const completedFilterBtn = document.querySelector('[data-filter="completed"]');
    completedFilterBtn.textContent = completedCount > 0 ? `Completed (${completedCount})` : 'Completed';

    // Show/hide clear completed button
    const clearBtn = document.getElementById('clearCompletedBtn');
    if (currentFilter === 'completed' && completedCount > 0) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }

    // Sort: Active first, then by priority (High > Medium > Low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    filteredTodos.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed - b.completed;
        const pA = priorityOrder[a.priority] !== undefined ? priorityOrder[a.priority] : 1;
        const pB = priorityOrder[b.priority] !== undefined ? priorityOrder[b.priority] : 1;
        return pA - pB;
    });


    if (filteredTodos.length === 0) {
        emptyState.style.display = 'block';
        if (currentFilter !== 'all') {
            emptyState.querySelector('p').textContent = `No ${currentFilter} tasks.`;
        } else {
            // Different message for guest vs user potentially
            if (todos.length === 0) {
                emptyState.querySelector('p').textContent = "No tasks found. Time to relax!";
            } else {
                emptyState.querySelector('p').textContent = "No tasks match current filter.";
            }
        }
    } else {
        emptyState.style.display = 'none';
    }

    filteredTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''} priority-${todo.priority || 'medium'}`;
        li.dataset.id = todo.id;

        // Format Date
        let dateBadge = '';
        if (todo.dueDate) {
            const date = new Date(todo.dueDate);
            // Adjust for timezone offset to show correct date selected
            const userTimezoneOffset = date.getTimezoneOffset() * 60000;
            const offsetDate = new Date(date.getTime() + userTimezoneOffset);
            dateBadge = `<span class="meta-date">${offsetDate.toLocaleDateString()}</span>`;
        }

        li.innerHTML = `
            <label class="checkbox-wrapper">
                <input type="checkbox" ${todo.completed ? 'checked' : ''}>
                <span class="custom-checkbox"></span>
            </label>
            <div class="todo-content">
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                <div class="todo-meta">
                     <span class="meta-priority ${todo.priority || 'medium'}">${todo.priority || 'medium'}</span>
                     ${dateBadge}
                </div>
            </div>
            <div class="todo-item-actions">
                <button class="edit-btn" aria-label="Edit task">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="delete-btn" aria-label="Delete task">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                         <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
                    </svg>
                </button>
            </div>
        `;

        attachItemListeners(li, todo);
        todoList.appendChild(li);
    });
}

// Utility
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- NAVIGATION ---
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const navItems = document.querySelectorAll('.nav-item');
const todoView = document.getElementById('todoView');
const notesView = document.getElementById('notesView');

function switchView(view) {
    if (currentView === view && !isMobileDevice()) return;

    currentView = view;

    // Update Nav UI
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    // Toggle Sections (Strict Exclusivity)
    if (view === 'todo') {
        todoView.classList.remove('hidden');
        notesView.classList.add('hidden');
    } else {
        todoView.classList.add('hidden');
        notesView.classList.remove('hidden');
        renderNotes();
    }

    // UI Polish: Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Auto-close sidebar
    closeSidebar();
}

function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.add('hidden');
    document.body.style.overflow = '';
}

navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
});

if (menuBtn) {
    menuBtn.addEventListener('click', openSidebar);
}

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', closeSidebar);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
}

// --- NOTES LOGIC ---
const notesList = document.getElementById('notesList');
const noteEditor = document.getElementById('noteEditor');
const notesEmptyState = document.getElementById('notesEmptyState');
const noteTitleInput = document.getElementById('noteTitle');
const noteContentInput = document.getElementById('noteContent');
const addNoteBtn = document.getElementById('addNoteBtn');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const downloadNoteBtn = document.getElementById('downloadNoteBtn');

function renderNotes() {
    notesList.innerHTML = '';
    notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    notes.forEach(note => {
        const li = document.createElement('li');
        li.className = `note-item ${currentNoteId === note.id ? 'active' : ''}`;
        li.innerHTML = `
            <h4>${escapeHtml(note.title || 'Untitled Note')}</h4>
            <p>${escapeHtml(note.content.substring(0, 30))}${note.content.length > 30 ? '...' : ''}</p>
        `;
        li.addEventListener('click', () => openNote(note.id));
        notesList.appendChild(li);
    });
}

function openNote(id) {
    currentNoteId = id;
    const note = notes.find(n => n.id === id);
    if (!note) return;

    noteTitleInput.value = note.title;
    noteContentInput.value = note.content;

    noteEditor.classList.remove('hidden');
    notesEmptyState.classList.add('hidden');
    renderNotes();
}

function addNote() {
    const newNote = {
        id: Date.now().toString(),
        title: '',
        content: '',
        updatedAt: new Date().toISOString()
    };
    notes.unshift(newNote);
    saveNotes();
    openNote(newNote.id);
}

function saveNote() {
    if (!currentNoteId) return;

    notes = notes.map(n => n.id === currentNoteId ? {
        ...n,
        title: noteTitleInput.value,
        content: noteContentInput.value,
        updatedAt: new Date().toISOString()
    } : n);

    saveNotes();
    renderNotes();

    // Visual feedback
    const originalText = saveNoteBtn.textContent;
    saveNoteBtn.textContent = "Saved!";
    setTimeout(() => saveNoteBtn.textContent = originalText, 2000);
}

function deleteNote() {
    if (!currentNoteId || !confirm("Are you sure you want to delete this note?")) return;

    notes = notes.filter(n => n.id !== currentNoteId);
    currentNoteId = null;
    saveNotes();

    noteEditor.classList.add('hidden');
    notesEmptyState.classList.remove('hidden');
    renderNotes();
}

function downloadNote() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    const blob = new Blob([note.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'note'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

addNoteBtn.addEventListener('click', addNote);
saveNoteBtn.addEventListener('click', saveNote);
deleteNoteBtn.addEventListener('click', deleteNote);
downloadNoteBtn.addEventListener('click', downloadNote);

// Initial Listeners — use form submit so the mobile keyboard action button works
const todoForm = document.getElementById('todoForm');
if (todoForm) {
    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTodo();
    });
}

// Also allow Enter on date & priority to add (they're inside the form, so submit handles it)
// But add explicit handlers for select (some browsers don't submit on Enter in select)
if (todoPriority) {
    todoPriority.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTodo();
        }
    });
}

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.filter-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTodos();
    });
});

document.getElementById('clearCompletedBtn').addEventListener('click', () => {
    todos = todos.filter(t => !t.completed);
    saveTodos();
    renderTodos();
});

// Initial Render (will be overridden by Auth observer if logged in)
loadTodosFromLocal();
loadNotesFromLocal();
