document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const todoInput = document.getElementById('todoInput');
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

        if (filteredTodos.length === 0) {
            emptyState.style.display = 'block';
            if (currentFilter !== 'all') {
                emptyState.querySelector('p').textContent = `No ${currentFilter} tasks.`;
            } else {
                emptyState.querySelector('p').textContent = "No tasks found. Enjoy your day!";
            }
        } else {
            emptyState.style.display = 'none';
        }

        filteredTodos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            li.dataset.id = todo.id;

            li.innerHTML = `
                <label class="checkbox-wrapper">
                    <input type="checkbox" ${todo.completed ? 'checked' : ''}>
                    <span class="custom-checkbox"></span>
                </label>
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                <button class="delete-btn" aria-label="Delete task">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;

            // Event Listeners for this item
            const checkbox = li.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => toggleTodo(todo.id));

            const deleteBtn = li.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling if we added click to row
                deleteTodo(todo.id, li);
            });

            todoList.appendChild(li);
        });
    }

    // Add Todo
    function addTodo() {
        const text = todoInput.value.trim();
        if (text) {
            const newTodo = {
                id: Date.now(),
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            };
            todos.unshift(newTodo); // Add to top
            saveTodos();
            renderTodos();
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
        // Add fade out animation class if you like
        element.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            todos = todos.filter(t => t.id !== id);
            saveTodos();
            renderTodos();
        }, 300);
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
