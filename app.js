document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const todoInput = document.getElementById('todoInput');
    const todoDate = document.getElementById('todoDate');
    const todoPriority = document.getElementById('todoPriority');
    const addBtn = document.getElementById('addBtn');
    const todoList = document.getElementById('todoList');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const clearCompletedBtn = document.getElementById('clearCompletedBtn');
    const dateDisplay = document.getElementById('dateDisplay');
    const emptyState = document.getElementById('emptyState');

    // State
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    let currentFilter = 'all';

    // Initialization
    function init() {
        renderDate();
        renderTodos();
    }

    // Date Display
    function renderDate() {
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
    }

    // Render Todos
    function renderTodos() {
        todoList.innerHTML = '';

        let filteredTodos = todos;
        if (currentFilter === 'active') {
            filteredTodos = todos.filter(t => !t.completed);
        } else if (currentFilter === 'completed') {
            filteredTodos = todos.filter(t => t.completed);
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
                emptyState.querySelector('p').textContent = "No tasks found. Time to relax!";
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
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            // Event Listeners for this item
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

            // Double click to edit (Inline) - Keep this as requested
            textSpan.addEventListener('dblclick', () => editTodo(todo.id, textSpan));

            todoList.appendChild(li);
        });
    }

    // Add Todo
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
            todos.unshift(newTodo);
            saveTodos();
            renderTodos();

            // Reset Inputs
            todoInput.value = '';
            todoInput.focus();
        }
    }

    // Toggle Todo
    function toggleTodo(id) {
        todos = todos.map(todo => {
            if (todo.id === id) {
                return { ...todo, completed: !todo.completed };
            }
            return todo;
        });
        saveTodos();
        renderTodos();
    }

    // Delete Todo
    function deleteTodo(id, element) {
        element.style.opacity = '0';
        element.style.transform = 'translateX(20px)';
        setTimeout(() => {
            todos = todos.filter(t => t.id !== id);
            saveTodos();
            renderTodos();
        }, 200);
    }

    // Edit Todo (Advanced Full Row)
    function editTodo(id, textSpan) {
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

    // Helper to re-attach listeners after cancel
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

    // Clear Completed
    function clearCompleted() {
        todos = todos.filter(t => !t.completed);
        saveTodos();
        renderTodos();
    }

    // Filter Logic
    function setFilter(filter) {
        currentFilter = filter;
        filterBtns.forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        renderTodos();
    }

    // Local Storage
    function saveTodos() {
        localStorage.setItem('todos', JSON.stringify(todos));
    }

    // Utility
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Global Event Listeners
    addBtn.addEventListener('click', addTodo);

    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setFilter(btn.dataset.filter);
        });
    });

    clearCompletedBtn.addEventListener('click', clearCompleted);

    // Start App
    init();
});
