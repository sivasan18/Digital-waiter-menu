// ============================================
// DATA & STATE MANAGEMENT
// ============================================

// Menu data
const menuData = {
    starters: [
        { id: 1, name: 'Chicken Wings', price: 180, category: 'starters' },
        { id: 2, name: 'Paneer Tikka', price: 160, category: 'starters' },
        { id: 3, name: 'Spring Rolls', price: 120, category: 'starters' },
        { id: 4, name: 'Garlic Bread', price: 100, category: 'starters' }
    ],
    main: [
        { id: 5, name: 'Butter Chicken', price: 280, category: 'main' },
        { id: 6, name: 'Paneer Butter Masala', price: 240, category: 'main' },
        { id: 7, name: 'Biryani', price: 220, category: 'main' },
        { id: 8, name: 'Pasta Alfredo', price: 200, category: 'main' }
    ],
    drinks: [
        { id: 9, name: 'Coke', price: 60, category: 'drinks' },
        { id: 10, name: 'Fresh Lime Soda', price: 50, category: 'drinks' },
        { id: 11, name: 'Mango Lassi', price: 80, category: 'drinks' },
        { id: 12, name: 'Coffee', price: 70, category: 'drinks' }
    ],
    desserts: [
        { id: 13, name: 'Ice Cream', price: 90, category: 'desserts' },
        { id: 14, name: 'Gulab Jamun', price: 70, category: 'desserts' },
        { id: 15, name: 'Brownie', price: 110, category: 'desserts' },
        { id: 16, name: 'Fruit Salad', price: 100, category: 'desserts' }
    ]
};

// Enhanced application state
let state = {
    currentTable: null,
    currentOrders: {},      // { tableNumber: { items: [] } } - Current cart
    kitchenOrders: [],      // All orders with status (pending/preparing/ready/served)
    tableStatus: {},        // { tableNumber: 'active' | 'vacated' }
    ownerBills: [],         // Completed bills for owner
    currentFilter: 'all',
    pendingVacation: null   // Table number pending vacation confirmation
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadTheme();
    loadStateFromStorage();

    // Clear all table statuses on app start to fix stuck tables
    state.tableStatus = {};

    renderTables();
    renderMenu();
    setupEventListeners();
    setupThemeToggle();
    updateUI();
    renderKitchenOrders();
    renderOwnerBills();
}

// ============================================
// LOCAL STORAGE
// ============================================

function loadStateFromStorage() {
    const saved = localStorage.getItem('waiterMenuState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.currentOrders = parsed.currentOrders || {};
            state.kitchenOrders = parsed.kitchenOrders || [];
            state.tableStatus = parsed.tableStatus || {};
            state.ownerBills = parsed.ownerBills || [];

            // Migrate old data: add default status if missing
            state.kitchenOrders.forEach(order => {
                if (!order.status) order.status = 'pending';
            });
        } catch (e) {
            console.error('Error loading state:', e);
        }
    }
}

function saveStateToStorage() {
    try {
        localStorage.setItem('waiterMenuState', JSON.stringify({
            currentOrders: state.currentOrders,
            kitchenOrders: state.kitchenOrders,
            tableStatus: state.tableStatus,
            ownerBills: state.ownerBills
        }));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

// ============================================
// THEME MANAGEMENT
// ============================================

function loadTheme() {
    const savedTheme = localStorage.getItem('waiterMenuTheme') || 'normal';
    setTheme(savedTheme);
}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('waiterMenuTheme', themeName);

    // Update toggle button states
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
}

function setupThemeToggle() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
        });
    });
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderTables() {
    const tableGrid = document.getElementById('table-grid');
    const tableCount = 8;

    tableGrid.innerHTML = '';

    for (let i = 1; i <= tableCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'table-btn';
        btn.dataset.table = i;

        // Check if table is vacated
        const isVacated = state.tableStatus[i] === 'vacated';
        if (isVacated) {
            btn.classList.add('vacated');
        }

        // Count active orders for this table
        const activeOrders = state.kitchenOrders.filter(
            order => order.table === i && order.status !== 'served'
        );

        btn.innerHTML = `
            <span class="table-icon">🪑</span>
            <span>Table ${i}</span>
            ${activeOrders.length > 0 ? `<span class="order-count-badge">${activeOrders.length}</span>` : ''}
        `;

        // Always allow selection to enable reset
        btn.addEventListener('click', () => selectTable(i));

        tableGrid.appendChild(btn);
    }
}

function renderMenu() {
    renderMenuCategory('starters', menuData.starters);
    renderMenuCategory('main', menuData.main);
    renderMenuCategory('drinks', menuData.drinks);
    renderMenuCategory('desserts', menuData.desserts);
}

function renderMenuCategory(category, items) {
    const container = document.getElementById(`menu-${category}`);
    container.innerHTML = '';

    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'menu-item';
        itemEl.innerHTML = `
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-price">₹${item.price}</div>
            </div>
            <button class="add-btn" data-item-id="${item.id}">+</button>
        `;

        const addBtn = itemEl.querySelector('.add-btn');
        addBtn.addEventListener('click', () => addItemToOrder(item));

        container.appendChild(itemEl);
    });
}

function renderOrderSummary() {
    const orderItemsEl = document.getElementById('order-items');
    const totalAmountEl = document.getElementById('total-amount');

    if (!state.currentTable) {
        orderItemsEl.innerHTML = '<p class="empty-state">Select a table first</p>';
        totalAmountEl.textContent = '₹0';
        return;
    }

    const order = state.currentOrders[state.currentTable];

    if (!order || !order.items || order.items.length === 0) {
        orderItemsEl.innerHTML = '<p class="empty-state">No items added yet</p>';
        totalAmountEl.textContent = '₹0';
        return;
    }

    // Group items by id and sum quantities
    const groupedItems = {};
    order.items.forEach(item => {
        if (groupedItems[item.id]) {
            groupedItems[item.id].quantity++;
        } else {
            groupedItems[item.id] = { ...item, quantity: 1 };
        }
    });

    let html = '';
    let total = 0;

    Object.values(groupedItems).forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        html += `
            <div class="order-item">
                <span class="order-item-name">${item.name}</span>
                <span class="order-item-qty">×${item.quantity}</span>
                <span class="order-item-price">₹${itemTotal}</span>
            </div>
        `;
    });

    orderItemsEl.innerHTML = html;
    totalAmountEl.textContent = `₹${total}`;
}

function renderTableStatus(tableNumber) {
    const statusOrdersEl = document.getElementById('status-orders');
    const selectedTableBadge = document.getElementById('selected-table-badge');

    if (!tableNumber) {
        statusOrdersEl.innerHTML = '<p class="empty-state">Select a table to view status</p>';
        selectedTableBadge.textContent = 'No Table';
        return;
    }

    selectedTableBadge.textContent = `Table ${tableNumber}`;

    // Get all orders for this table
    const tableOrders = state.kitchenOrders.filter(order => order.table === tableNumber);

    if (tableOrders.length === 0) {
        statusOrdersEl.innerHTML = '<p class="empty-state">No orders for this table yet</p>';
        return;
    }

    // Sort by timestamp (newest first)
    tableOrders.sort((a, b) => b.timestamp - a.timestamp);

    let html = '';

    tableOrders.forEach(order => {
        const orderTime = new Date(order.timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Group items
        const groupedItems = {};
        order.items.forEach(item => {
            if (groupedItems[item.id]) {
                groupedItems[item.id].quantity++;
            } else {
                groupedItems[item.id] = { ...item, quantity: 1 };
            }
        });

        let itemsHtml = '';
        let total = 0;

        Object.values(groupedItems).forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemsHtml += `${item.name} x${item.quantity}, `;
        });

        itemsHtml = itemsHtml.slice(0, -2); // Remove trailing comma

        html += `
            <div class="status-order-card ${order.status}">
                <div class="status-order-header">
                    <span class="status-order-time">${orderTime}</span>
                    <span class="status-badge ${order.status}">${order.status.toUpperCase()}</span>
                </div>
                <div class="status-order-items">${itemsHtml}</div>
                <div class="status-order-total">Total: ₹${total}</div>
            </div>
        `;
    });

    statusOrdersEl.innerHTML = html;

    // Update button states
    updateTableActionButtons(tableNumber);
}

function updateTableActionButtons(tableNumber) {
    const markServedBtn = document.getElementById('mark-served-btn');
    const vacateBtn = document.getElementById('vacate-table-btn');

    const tableOrders = state.kitchenOrders.filter(order => order.table === tableNumber);
    const hasReadyOrders = tableOrders.some(order => order.status === 'ready');
    const hasAnyOrders = tableOrders.length > 0;

    markServedBtn.disabled = !hasReadyOrders;
    vacateBtn.disabled = !hasAnyOrders;
}

function renderKitchenOrders() {
    const ordersList = document.getElementById('orders-list');

    console.log('renderKitchenOrders called, total orders:', state.kitchenOrders.length);
    console.log('Current filter:', state.currentFilter);

    // Filter orders based on current filter
    let filteredOrders = state.kitchenOrders;
    if (state.currentFilter !== 'all') {
        filteredOrders = state.kitchenOrders.filter(order => order.status === state.currentFilter);
    }

    console.log('Filtered orders:', filteredOrders.length);

    if (!ordersList) {
        console.error('orders-list element not found!');
        return;
    }

    if (filteredOrders.length === 0) {
        ordersList.innerHTML = '<p class="empty-state">No orders to display</p>';
        return;
    }

    // Sort by timestamp (newest first)
    filteredOrders.sort((a, b) => b.timestamp - a.timestamp);

    let html = '';

    filteredOrders.forEach(order => {
        const orderTime = new Date(order.timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Group items
        const groupedItems = {};
        order.items.forEach(item => {
            if (groupedItems[item.id]) {
                groupedItems[item.id].quantity++;
            } else {
                groupedItems[item.id] = { ...item, quantity: 1 };
            }
        });

        let itemsHtml = '';
        let total = 0;

        Object.values(groupedItems).forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemsHtml += `
                <div class="order-list-item">
                    <span><strong>${item.name}</strong> × ${item.quantity}</span>
                    <span>₹${itemTotal}</span>
                </div>
            `;
        });

        const statusClass = order.status || 'pending';

        html += `
            <div class="order-card ${statusClass}">
                <div class="order-header">
                    <div class="order-table">🪑 Table ${order.table}</div>
                    <div class="order-time">⏰ ${orderTime}</div>
                </div>
                <div class="order-items-list">
                    ${itemsHtml}
                </div>
                <div class="order-footer">
                    <div class="order-total-amount">Total: ₹${total}</div>
                    <div class="status-actions">
                        <button class="status-btn preparing ${statusClass === 'preparing' ? 'active' : ''}" 
                                onclick="updateOrderStatus(${order.id}, 'preparing')"
                                ${statusClass !== 'pending' ? 'disabled' : ''}>
                            Preparing
                        </button>
                        <button class="status-btn ready ${statusClass === 'ready' ? 'active' : ''}" 
                                onclick="updateOrderStatus(${order.id}, 'ready')"
                                ${statusClass !== 'preparing' ? 'disabled' : ''}>
                            Ready
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    ordersList.innerHTML = html;
}

function renderOwnerBills() {
    const billsList = document.getElementById('bills-list');
    const totalBillsCount = document.getElementById('total-bills-count');
    const totalRevenue = document.getElementById('total-revenue');

    if (!billsList) return;

    if (state.ownerBills.length === 0) {
        billsList.innerHTML = '<p class="empty-state">No bills generated yet</p>';
        totalBillsCount.textContent = '0';
        totalRevenue.textContent = '₹0';
        return;
    }

    // Calculate totals
    const revenue = state.ownerBills.reduce((sum, bill) => sum + bill.grandTotal, 0);
    totalBillsCount.textContent = state.ownerBills.length;
    totalRevenue.textContent = `₹${revenue}`;

    // Sort by timestamp (newest first)
    const sortedBills = [...state.ownerBills].sort((a, b) => b.timestamp - a.timestamp);

    let html = '';

    sortedBills.forEach((bill, index) => {
        const billTime = new Date(bill.timestamp).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Summarize items
        let itemsSummary = '';
        const itemCount = bill.items.length;
        const firstItems = bill.items.slice(0, 3);

        firstItems.forEach(item => {
            itemsSummary += `${item.name} x${item.quantity}, `;
        });

        if (itemCount > 3) {
            itemsSummary += `+${itemCount - 3} more`;
        } else {
            itemsSummary = itemsSummary.slice(0, -2);
        }

        // Show View Details button for bills with 5+ items
        const showDetailsBtn = itemCount >= 5
            ? `<button class="bill-card-details-btn" onclick="showBillDetails(${index})">View Details</button>`
            : '';

        html += `
            <div class="bill-card" data-bill-index="${index}">
                <div class="bill-card-header">
                    <div class="bill-card-table">🪑 Table ${bill.table} Bill</div>
                    <div class="bill-card-time">⏰ ${billTime}</div>
                </div>
                <div class="bill-card-items">
                    ${itemsSummary}
                </div>
                <div class="bill-card-footer">
                    <div class="bill-card-total">₹${bill.grandTotal}</div>
                    <div class="bill-card-count">${itemCount} items</div>
                </div>
                ${showDetailsBtn}
            </div>
        `;
    });

    billsList.innerHTML = html;
}

// ============================================
// BILL DETAIL PANEL
// ============================================

function showBillDetails(billIndex) {
    const sortedBills = [...state.ownerBills].sort((a, b) => b.timestamp - a.timestamp);
    const bill = sortedBills[billIndex];

    if (!bill) return;

    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('detail-panel-overlay');
    const title = document.getElementById('detail-panel-title');
    const body = document.getElementById('detail-panel-body');

    title.textContent = `Table ${bill.table} Bill`;

    const billTime = new Date(bill.timestamp).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let itemsHtml = '';
    bill.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHtml += `
            <div class="detail-item">
                <span class="detail-item-name">${item.name}</span>
                <div class="detail-item-info">
                    <span class="detail-item-qty">× ${item.quantity}</span>
                    <span class="detail-item-price">₹${itemTotal}</span>
                </div>
            </div>
        `;
    });

    body.innerHTML = `
        <div class="detail-table-info">
            <span class="detail-table-number">Table ${bill.table}</span>
            <span class="detail-table-time">${billTime}</span>
        </div>
        <div class="detail-items-list">
            ${itemsHtml}
        </div>
        <div class="detail-total">
            <span class="detail-total-label">Grand Total</span>
            <span class="detail-total-amount">₹${bill.grandTotal}</span>
        </div>
    `;

    panel.classList.add('show');
    overlay.classList.add('show');
}

function closeBillDetailsPanel() {
    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('detail-panel-overlay');
    panel.classList.remove('show');
    overlay.classList.remove('show');
}

// Make function globally accessible
window.showBillDetails = showBillDetails;

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });

    // Order actions
    document.getElementById('clear-order-btn').addEventListener('click', clearOrder);
    document.getElementById('send-to-kitchen-btn').addEventListener('click', sendToKitchen);

    // Table actions
    document.getElementById('mark-served-btn').addEventListener('click', markReadyItemsServed);
    document.getElementById('vacate-table-btn').addEventListener('click', initiateTableVacation);

    // Kitchen filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const status = e.currentTarget.dataset.status;
            filterKitchenOrders(status);
        });
    });

    // Modal actions
    document.getElementById('modal-close-btn').addEventListener('click', closeBillModal);
    document.getElementById('cancel-vacate-btn').addEventListener('click', closeBillModal);
    document.getElementById('confirm-vacate-btn').addEventListener('click', confirmTableVacation);

    // Detail panel actions
    document.getElementById('detail-panel-close').addEventListener('click', closeBillDetailsPanel);
    document.getElementById('detail-panel-overlay').addEventListener('click', closeBillDetailsPanel);

    // Daily Report button
    document.getElementById('download-daily-report-btn').addEventListener('click', generateDailyReport);

    // Edit Mode button
    document.getElementById('edit-mode-btn').addEventListener('click', toggleEditMode);

    // Clear All Billing Data button
    document.getElementById('clear-all-billing-btn').addEventListener('click', clearAllBillingData);
}

// ============================================
// ACTION FUNCTIONS
// ============================================

function selectTable(tableNumber) {
    // Reset table status to active when selected
    if (state.tableStatus[tableNumber] === 'vacated') {
        state.tableStatus[tableNumber] = 'active';
        saveStateToStorage();
    }

    state.currentTable = tableNumber;

    // Ensure order object exists for this table
    if (!state.currentOrders[tableNumber]) {
        state.currentOrders[tableNumber] = {
            table: tableNumber,
            items: []
        };
    }

    updateUI();
    renderTableStatus(tableNumber);
    showToast(`Table ${tableNumber} selected`, 'success');
}

function addItemToOrder(item) {
    if (!state.currentTable) {
        showToast('Please select a table first', 'error');
        return;
    }

    state.currentOrders[state.currentTable].items.push(item);
    saveStateToStorage();
    renderOrderSummary();
    updateUI(); // Enable the Send to Kitchen button
    showToast(`${item.name} added`, 'success');
}

function clearOrder() {
    if (!state.currentTable) {
        showToast('No table selected', 'error');
        return;
    }

    state.currentOrders[state.currentTable].items = [];
    saveStateToStorage();
    renderOrderSummary();
    updateUI(); // Update button state after clearing
    showToast('Order cleared', 'success');
}

function sendToKitchen() {
    console.log('Send to kitchen clicked, current table:', state.currentTable);

    if (!state.currentTable) {
        showToast('Please select a table first', 'error');
        return;
    }

    const order = state.currentOrders[state.currentTable];
    console.log('Current order:', order);

    if (!order || !order.items || order.items.length === 0) {
        showToast('No items to send', 'error');
        return;
    }

    // Create kitchen order (do NOT overwrite existing orders)
    const kitchenOrder = {
        id: Date.now(),
        table: state.currentTable,
        items: [...order.items],
        timestamp: Date.now(),
        status: 'pending'
    };

    console.log('Created kitchen order:', kitchenOrder);
    state.kitchenOrders.push(kitchenOrder);

    // Clear current order for new items
    state.currentOrders[state.currentTable].items = [];

    saveStateToStorage();
    renderOrderSummary();
    renderKitchenOrders();
    renderTableStatus(state.currentTable);
    renderTables(); // Update order count badges
    updateUI();

    console.log('Kitchen orders after send:', state.kitchenOrders);
    showToast(`Order sent to kitchen for Table ${state.currentTable}`, 'success');
}

function updateOrderStatus(orderId, status) {
    console.log('Updating order status:', orderId, status);
    const order = state.kitchenOrders.find(o => o.id === orderId);
    if (order) {
        order.status = status;
        saveStateToStorage();
        renderKitchenOrders();

        // Update table status panel if this table is currently selected
        if (state.currentTable && order.table === state.currentTable) {
            renderTableStatus(state.currentTable);
        }

        renderTables(); // Update order count badges
        showToast(`Order status updated to ${status}`, 'success');
    }
}

// Make function globally accessible for onclick handlers
window.updateOrderStatus = updateOrderStatus;

function markReadyItemsServed() {
    if (!state.currentTable) {
        showToast('No table selected', 'error');
        return;
    }

    // Find all ready orders for this table
    const readyOrders = state.kitchenOrders.filter(
        order => order.table === state.currentTable && order.status === 'ready'
    );

    if (readyOrders.length === 0) {
        showToast('No ready items to mark as served', 'error');
        return;
    }

    // Update all ready orders to served
    readyOrders.forEach(order => {
        order.status = 'served';
    });

    saveStateToStorage();
    renderTableStatus(state.currentTable);
    renderKitchenOrders();
    renderTables();

    showToast(`Marked ${readyOrders.length} order(s) as served for Table ${state.currentTable}`, 'success');
}

function initiateTableVacation() {
    if (!state.currentTable) {
        showToast('No table selected', 'error');
        return;
    }

    const tableNumber = state.currentTable;

    // Get all orders for this table
    const tableOrders = state.kitchenOrders.filter(order => order.table === tableNumber);

    if (tableOrders.length === 0) {
        showToast('No orders to bill for this table', 'error');
        return;
    }

    // Group all items from all orders
    const allItems = {};
    let grandTotal = 0;

    tableOrders.forEach(order => {
        order.items.forEach(item => {
            if (allItems[item.id]) {
                allItems[item.id].quantity++;
            } else {
                allItems[item.id] = { ...item, quantity: 1 };
            }
            grandTotal += item.price;
        });
    });

    const groupedItems = Object.values(allItems);

    // Store pending vacation data
    state.pendingVacation = {
        table: tableNumber,
        orders: tableOrders,
        items: groupedItems,
        grandTotal: grandTotal
    };

    // Show bill modal
    showBillModal(tableNumber, groupedItems, grandTotal);
}

function showBillModal(tableNumber, items, grandTotal) {
    const modal = document.getElementById('bill-modal');
    const modalTableNumber = document.getElementById('modal-table-number');
    const billTable = document.getElementById('bill-table');
    const billDatetime = document.getElementById('bill-datetime');
    const billItems = document.getElementById('bill-items');
    const billGrandTotal = document.getElementById('bill-grand-total');

    // Set table number in modal title
    modalTableNumber.textContent = `Table ${tableNumber}`;
    billTable.textContent = `Table ${tableNumber}`;
    billDatetime.textContent = new Date().toLocaleString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Generate detailed items list (showing unit price and subtotal)
    let itemsHtml = '';
    items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHtml += `
            <div class="bill-item">
                <span class="bill-item-name">${item.name}</span>
                <span class="bill-item-details">
                    <span class="bill-item-unit-price">₹${item.price}</span>
                    <span class="bill-item-qty">× ${item.quantity}</span>
                </span>
                <span class="bill-item-price">₹${itemTotal}</span>
            </div>
        `;
    });

    billItems.innerHTML = itemsHtml;
    billGrandTotal.textContent = `₹${grandTotal}`;

    modal.classList.add('show');
}

function closeBillModal() {
    const modal = document.getElementById('bill-modal');
    modal.classList.remove('show');
    state.pendingVacation = null;
}

function confirmTableVacation() {
    if (!state.pendingVacation) {
        showToast('No pending vacation', 'error');
        return;
    }

    const { table, orders, items, grandTotal } = state.pendingVacation;

    // Create owner bill record
    const bill = {
        id: Date.now(),
        table: table,
        timestamp: Date.now(),
        orders: orders,
        items: items,
        grandTotal: grandTotal,
        paymentStatus: 'pending'
    };

    // Add to owner bills
    state.ownerBills.push(bill);

    // Mark table as active (available for next customer)
    state.tableStatus[table] = 'active';

    // Clear current order for this table
    state.currentOrders[table] = {
        table: table,
        items: []
    };

    // Remove orders for this table from kitchen (archive them)
    state.kitchenOrders = state.kitchenOrders.filter(order => order.table !== table);

    // Save state
    saveStateToStorage();

    // Close modal
    closeBillModal();

    // Update UI
    renderTables();
    renderOwnerBills();
    renderKitchenOrders();

    // Deselect table
    if (state.currentTable === table) {
        state.currentTable = null;
        renderOrderSummary();
        renderTableStatus(null);
    }

    updateUI();

    showToast(`Table ${table} vacated. Bill generated successfully!`, 'success');
}

function filterKitchenOrders(status) {
    state.currentFilter = status;

    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });

    renderKitchenOrders();
}

function switchView(view) {
    console.log('Switching to view:', view);

    // Update view buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Update view content
    document.querySelectorAll('.view-content').forEach(content => {
        content.classList.toggle('active', content.id === `${view}-view`);
    });

    console.log('Active view:', view);

    // Refresh respective view when switching to it
    if (view === 'kitchen') {
        console.log('Rendering kitchen orders, current orders:', state.kitchenOrders);
        renderKitchenOrders();
    } else if (view === 'billing') {
        renderOwnerBills();
    }
}

// ============================================
// UI UPDATE HELPERS
// ============================================

function updateUI() {
    // Update table selection
    document.querySelectorAll('.table-btn').forEach(btn => {
        const tableNum = parseInt(btn.dataset.table);
        btn.classList.toggle('active', tableNum === state.currentTable);
    });

    // Update table badge
    const tableBadge = document.getElementById('current-table-badge');
    if (state.currentTable) {
        tableBadge.textContent = `Table ${state.currentTable}`;
        tableBadge.classList.remove('no-table');
    } else {
        tableBadge.textContent = 'No Table Selected';
        tableBadge.classList.add('no-table');
    }

    // Update order summary
    renderOrderSummary();

    // Update send button
    const sendBtn = document.getElementById('send-to-kitchen-btn');
    const hasItems = state.currentTable &&
        state.currentOrders[state.currentTable] &&
        state.currentOrders[state.currentTable].items.length > 0;
    sendBtn.disabled = !hasItems;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ============================================
// PASSWORD PROTECTION
// ============================================

function checkAdminPassword() {
    const password = prompt('Enter admin password to continue:');
    return password === 'admin123';
}

// ============================================
// DAILY REPORT PDF GENERATION
// ============================================

function generateDailyReport() {
    try {
        // Show date picker
        const selectedDate = prompt('Enter date for report (YYYY-MM-DD format):\n\nExamples:\n- Today: ' + new Date().toISOString().split('T')[0] + '\n- Yesterday: ' + new Date(Date.now() - 86400000).toISOString().split('T')[0], new Date().toISOString().split('T')[0]);

        if (!selectedDate) {
            showToast('Report generation cancelled', 'error');
            return;
        }

        // Parse selected date
        const reportDate = new Date(selectedDate + 'T00:00:00');
        if (isNaN(reportDate.getTime())) {
            showToast('Invalid date format. Please use YYYY-MM-DD', 'error');
            return;
        }

        const dayStart = new Date(reportDate.setHours(0, 0, 0, 0));
        const dayEnd = new Date(reportDate.setHours(23, 59, 59, 999));

        // Filter bills for selected date
        const dateBills = state.ownerBills.filter(bill => {
            const billDate = new Date(bill.timestamp);
            return billDate >= dayStart && billDate <= dayEnd;
        });

        if (dateBills.length === 0) {
            showToast(`No bills found for ${selectedDate}`, 'error');
            return;
        }

        // Create PDF using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Title
        const reportDateFormatted = new Date(selectedDate).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Daily Sales Report', 105, 15, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(reportDateFormatted, 105, 23, { align: 'center' });

        let y = 35;
        let grandTotal = 0;

        // Group bills by table
        const billsByTable = {};
        dateBills.forEach(bill => {
            if (!billsByTable[bill.table]) {
                billsByTable[bill.table] = [];
            }
            billsByTable[bill.table].push(bill);
        });

        // Iterate through each table
        Object.keys(billsByTable).sort((a, b) => parseInt(a) - parseInt(b)).forEach(tableNum => {
            const tableBills = billsByTable[tableNum];
            let tableTotal = 0;

            // Table header
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`Table ${tableNum}`, 15, y);
            y += 7;

            // Items
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            tableBills.forEach(bill => {
                bill.items.forEach(item => {
                    const itemTotal = item.price * item.quantity;
                    tableTotal += itemTotal;

                    doc.text(`${item.name} x${item.quantity}`, 20, y);
                    doc.text(`Rs.${itemTotal}`, 180, y, { align: 'right' });
                    y += 5;

                    if (y > 270) {
                        doc.addPage();
                        y = 15;
                    }
                });
            });

            // Table subtotal
            doc.setFont('helvetica', 'bold');
            doc.text(`Subtotal:`, 20, y);
            doc.text(`Rs.${tableTotal}`, 180, y, { align: 'right' });
            y += 8;
            doc.setFont('helvetica', 'normal');

            grandTotal += tableTotal;

            if (y > 260) {
                doc.addPage();
                y = 15;
            }
        });

        // Grand Total
        y += 5;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.line(15, y, 195, y);
        y += 7;
        doc.text('GRAND TOTAL:', 15, y);
        doc.text(`Rs.${grandTotal}`, 180, y, { align: 'right' });

        // Save PDF
        const filename = `Daily_Report_${selectedDate}.pdf`;
        doc.save(filename);

        showToast(`Report for ${selectedDate} downloaded successfully!`, 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Error generating PDF report', 'error');
    }
}

// ============================================
// EDIT MODE MANAGEMENT
// ============================================

let isEditModeActive = false;

function toggleEditMode() {
    if (!isEditModeActive) {
        // Activate Edit Mode with password
        if (!checkAdminPassword()) {
            showToast('Incorrect password - Edit Mode not activated', 'error');
            return;
        }

        isEditModeActive = true;
        document.getElementById('edit-mode-btn').textContent = '🔒 Exit Edit Mode';
        document.getElementById('edit-mode-btn').classList.add('active');

        // Show Clear All button
        const clearAllBtn = document.getElementById('clear-all-billing-btn');
        if (clearAllBtn) {
            clearAllBtn.style.display = 'inline-block';
        }

        // Add delete icons to all bill cards
        addDeleteIconsToCards();

        showToast('Edit Mode activated', 'success');
    } else {
        // Deactivate Edit Mode
        isEditModeActive = false;
        document.getElementById('edit-mode-btn').textContent = '✏️ Edit Mode';
        document.getElementById('edit-mode-btn').classList.remove('active');

        // Hide Clear All button
        const clearAllBtn = document.getElementById('clear-all-billing-btn');
        if (clearAllBtn) {
            clearAllBtn.style.display = 'none';
        }

        // Remove delete icons
        removeDeleteIconsFromCards();

        showToast('Edit Mode deactivated', 'success');
    }
}

function addDeleteIconsToCards() {
    const billCards = document.querySelectorAll('.bill-card');
    billCards.forEach((card, index) => {
        const billIndex = card.getAttribute('data-bill-index');
        if (!card.querySelector('.bill-delete-icon')) {
            const deleteIcon = document.createElement('button');
            deleteIcon.className = 'bill-delete-icon';
            deleteIcon.innerHTML = '🗑️';
            deleteIcon.title = 'Delete Bill';
            deleteIcon.onclick = () => deleteBill(parseInt(billIndex));
            card.appendChild(deleteIcon);
        }
    });
}

function removeDeleteIconsFromCards() {
    const deleteIcons = document.querySelectorAll('.bill-delete-icon');
    deleteIcons.forEach(icon => icon.remove());
}

function clearAllBillingData() {
    if (!isEditModeActive) {
        showToast('Edit Mode must be active', 'error');
        return;
    }

    if (!checkAdminPassword()) {
        showToast('Incorrect password', 'error');
        return;
    }

    const confirmed = confirm('⚠️ WARNING: This will permanently delete ALL billing records!\n\nThis action cannot be undone.\n\nAre you absolutely sure?');

    if (!confirmed) return;

    // Clear all billing data
    state.ownerBills = [];
    saveStateToStorage();
    renderOwnerBills();

    // Deactivate Edit Mode
    isEditModeActive = false;
    document.getElementById('edit-mode-btn').textContent = '✏️ Edit Mode';
    document.getElementById('edit-mode-btn').classList.remove('active');
    document.getElementById('clear-all-billing-btn').style.display = 'none';

    showToast('All billing data cleared successfully', 'success');
}

// ============================================
// BILLING CRUD OPERATIONS
// ============================================

function deleteBill(billIndex) {
    if (!checkAdminPassword()) {
        showToast('Incorrect password', 'error');
        return;
    }

    const sortedBills = [...state.ownerBills].sort((a, b) => b.timestamp - a.timestamp);
    const bill = sortedBills[billIndex];

    if (!bill) {
        showToast('Bill not found', 'error');
        return;
    }

    const confirmed = confirm(`Are you sure you want to delete Table ${bill.table} bill?\n\nTotal: Rs.${bill.grandTotal}\n\nThis action cannot be undone.`);

    if (!confirmed) return;

    // Find original bill index in unsorted array
    const originalIndex = state.ownerBills.findIndex(b => b.id === bill.id);

    if (originalIndex !== -1) {
        state.ownerBills.splice(originalIndex, 1);
        saveStateToStorage();
        renderOwnerBills();
        showToast('Bill deleted successfully', 'success');
    }
}

// Make function globally accessible
window.deleteBill = deleteBill;

// ============================================
// CLEAR DATA UTILITY
// ============================================

// Clear all table statuses to fix stuck tables
function clearAllTableStatuses() {
    state.tableStatus = {};
    saveStateToStorage();
    renderTables();
    showToast('All table statuses cleared', 'success');
}
