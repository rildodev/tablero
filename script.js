// Kanban Board Script - localStorage only version

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded event fired. Initializing application modules...");

    const DOMElements = {
        themeToggleButton: document.getElementById("themeToggleBtn"),
        themeIcon: document.getElementById("themeIcon"),
        kanbanContainer: document.getElementById("kanbanContainer"),
        cardModal: document.getElementById("cardModal"),
        cardModalTitle: document.getElementById("cardModalTitle"),
        cardTitleInput: document.getElementById("cardTitleInput"),
        cardDescriptionInput: document.getElementById("cardDescriptionInput"),
        saveCardBtn: document.getElementById("saveCardBtn"),
    };

    if (!DOMElements.kanbanContainer) {
        console.error("CRITICAL: kanbanContainer element not found in DOM! Boards cannot be rendered.");
        return;
    }
    console.log("kanbanContainer element successfully found:", DOMElements.kanbanContainer);

    let AppState = {
        currentEditingBoardId: null,
        currentEditingCardElement: null,
        currentEditingCardId: null,
        draggedCard: null,
        isSavingCard: false, 
    };

    const getFormattedTimestamp = (timestampInput) => {
        if (!timestampInput) return "";
        let date;
        if (typeof timestampInput === "string" || typeof timestampInput === "number") {
            date = new Date(timestampInput);
        } else if (timestampInput instanceof Date) {
            date = timestampInput;
        } else {
            console.warn("Invalid timestamp input for formatting:", timestampInput);
            return ""; // Or a default string like "Invalid Date"
        }
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const ThemeManager = (() => {
        function updateIcon(theme) {
            if (DOMElements.themeIcon) DOMElements.themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
        }
        function applyTheme(theme) {
            document.documentElement.setAttribute("data-theme", theme);
            updateIcon(theme);
        }
        function toggleTheme() {
            let currentTheme = document.documentElement.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);
            updateIcon(newTheme);
        }
        function init() {
            console.log("ThemeManager: Initializing...");
            const storedTheme = localStorage.getItem("theme") || "light";
            applyTheme(storedTheme);
            if (DOMElements.themeToggleButton) DOMElements.themeToggleButton.addEventListener("click", toggleTheme);
            console.log("ThemeManager: Initialized.");
        }
        return { init };
    })();

    const ModalManager = (() => {
        function open(modalElement, title) {
            if (!modalElement) {
                console.error("ModalManager.open: modalElement is null");
                return;
            }
            if (modalElement === DOMElements.cardModal && DOMElements.cardModalTitle) DOMElements.cardModalTitle.textContent = title;
            modalElement.style.display = "block";
        }
        function close(modalElement) {
            if (!modalElement) {
                console.error("ModalManager.close: modalElement is null");
                return;
            }
            modalElement.style.display = "none";
            if (DOMElements.cardTitleInput) DOMElements.cardTitleInput.value = "";
            if (DOMElements.cardDescriptionInput) DOMElements.cardDescriptionInput.value = "";
            AppState.currentEditingBoardId = null;
            AppState.currentEditingCardElement = null;
            AppState.currentEditingCardId = null;
            AppState.isSavingCard = false; 
            if(DOMElements.saveCardBtn) DOMElements.saveCardBtn.disabled = false; 
        }
        function init() {
            console.log("ModalManager: Initializing...");
            document.querySelectorAll(".close-btn, .cancel-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const modalToCloseId = e.target.dataset.modalId;
                    if (modalToCloseId) {
                        const modalToClose = document.getElementById(modalToCloseId);
                        if (modalToClose) close(modalToClose);
                    } else {
                        // Fallback for modals that might not have data-modal-id on the button itself
                        const parentModal = e.target.closest(".modal");
                        if (parentModal) close(parentModal);
                    }
                });
            });
            window.addEventListener("click", (event) => {
                if (event.target === DOMElements.cardModal) close(DOMElements.cardModal);
            });
            console.log("ModalManager: Initialized.");
        }
        return { open, close, init };
    })();

    let BoardManager;
    let CardManager;

    const DragDropManager = (() => {
        function handleDragStart(e) {
            if (e.target.classList.contains("card")) {
                AppState.draggedCard = e.target;
                setTimeout(() => e.target.classList.add("dragging"), 0);
            }
        }
        function handleDragEnd() {
            if (AppState.draggedCard) {
                AppState.draggedCard.classList.remove("dragging");
                AppState.draggedCard = null;
            }
        }
        function handleDrop(e, targetBoardId) {
            e.preventDefault();
            const targetCardsContainer = e.target.closest(".cards-container");
            if (targetCardsContainer && AppState.draggedCard) {
                const cardId = AppState.draggedCard.dataset.cardId;
                const originalBoardId = AppState.draggedCard.dataset.originalBoardId;
                targetCardsContainer.style.backgroundColor = "";

                let allCards = JSON.parse(localStorage.getItem("cards")) || [];
                const cardIndex = allCards.findIndex(c => c.id === cardId);

                if (cardIndex === -1) {
                    console.error("Dragged card not found in localStorage");
                    return;
                }

                if (targetBoardId !== originalBoardId) {
                    allCards[cardIndex].boardId = targetBoardId;
                    allCards[cardIndex].order = Date.now(); // Update order on move to new board
                    localStorage.setItem("cards", JSON.stringify(allCards));
                    
                    // Re-render both affected boards
                    if (BoardManager) {
                        const originBoardData = BoardManager.FIXED_BOARDS.find(b => b.id === originalBoardId);
                        const targetBoardData = BoardManager.FIXED_BOARDS.find(b => b.id === targetBoardId);
                        if(originBoardData) BoardManager.renderBoard(originBoardData);
                        if(targetBoardData) BoardManager.renderBoard(targetBoardData);
                    }
                } else {
                    // Reordering within the same board
                    targetCardsContainer.appendChild(AppState.draggedCard);
                    const cardsInOrder = Array.from(targetCardsContainer.children);
                    cardsInOrder.forEach((cardEl, index) => {
                        const cId = cardEl.dataset.cardId;
                        const cardInStorage = allCards.find(c => c.id === cId);
                        if (cardInStorage) cardInStorage.order = index;
                    });
                    localStorage.setItem("cards", JSON.stringify(allCards));
                }
            }
        }
        function enableDropZone(cardsContainerElement, boardId) {
            cardsContainerElement.addEventListener("dragover", (e) => e.preventDefault());
            cardsContainerElement.addEventListener("dragenter", (e) => {
                e.preventDefault();
                if (e.target.classList.contains("cards-container")) e.target.style.backgroundColor = "rgba(0,0,0,0.05)";
            });
            cardsContainerElement.addEventListener("dragleave", (e) => {
                if (e.target.classList.contains("cards-container")) e.target.style.backgroundColor = "";
            });
            cardsContainerElement.addEventListener("drop", (e) => handleDrop(e, boardId));
        }
        return { handleDragStart, handleDragEnd, enableDropZone };
    })();

    CardManager = (() => {
        function openModalForCard(boardElement, boardId, cardElement = null, cardId = null, title = "", description = "") {
            AppState.currentEditingBoardId = boardId;
            AppState.currentEditingCardElement = cardElement;
            AppState.currentEditingCardId = cardId;
            const modalTitleText = cardId ? "Editar Card" : "Adicionar Novo Card";
            DOMElements.cardTitleInput.value = title;
            DOMElements.cardDescriptionInput.value = description;
            ModalManager.open(DOMElements.cardModal, modalTitleText);
        }

        function saveCard() {
            if (AppState.isSavingCard) return;
            AppState.isSavingCard = true;
            if(DOMElements.saveCardBtn) DOMElements.saveCardBtn.disabled = true;

            const title = DOMElements.cardTitleInput.value.trim();
            const description = DOMElements.cardDescriptionInput.value;
            if (!title) {
                alert("Por favor, insira um título para o card.");
                AppState.isSavingCard = false;
                if(DOMElements.saveCardBtn) DOMElements.saveCardBtn.disabled = false;
                return;
            }
            const now = new Date().toISOString();
            const cardPayload = { title, description, updatedAt: now };
            let allCards = JSON.parse(localStorage.getItem("cards")) || [];

            if (AppState.currentEditingCardId) {
                const cardIndex = allCards.findIndex(c => c.id === AppState.currentEditingCardId);
                if (cardIndex > -1) {
                    allCards[cardIndex] = { ...allCards[cardIndex], ...cardPayload };
                }
            } else {
                cardPayload.boardId = AppState.currentEditingBoardId;
                cardPayload.createdAt = now;
                cardPayload.order = Date.now(); 
                cardPayload.id = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                allCards.push(cardPayload);
            }
            localStorage.setItem("cards", JSON.stringify(allCards));
            
            if (BoardManager) {
                const boardToRender = BoardManager.FIXED_BOARDS.find(b => b.id === AppState.currentEditingBoardId);
                if (boardToRender) BoardManager.renderBoard(boardToRender);
            }
            ModalManager.close(DOMElements.cardModal);
        }

        function deleteCard(cardId, cardTitle) {
            if (confirm(`Tem certeza que deseja excluir o card "${cardTitle}"?`)) {
                let allCards = JSON.parse(localStorage.getItem("cards")) || [];
                const cardToDelete = allCards.find(c => c.id === cardId);
                if (!cardToDelete) return;

                const boardToUpdateId = cardToDelete.boardId;
                allCards = allCards.filter(c => c.id !== cardId);
                localStorage.setItem("cards", JSON.stringify(allCards));

                const cardElement = DOMElements.kanbanContainer.querySelector(`[data-card-id="${cardId}"]`);
                if (cardElement) cardElement.remove();
                
                // Re-render the board to reflect deletion if BoardManager is available
                if (BoardManager && boardToUpdateId) {
                    const boardToRender = BoardManager.FIXED_BOARDS.find(b => b.id === boardToUpdateId);
                    if (boardToRender) BoardManager.renderBoard(boardToRender);
                }
            }
        }

        function renderCard(cardData, boardElement) {
            const cardsContainer = boardElement.querySelector(".cards-container");
            if (!cardsContainer) return;
            let cardDiv = cardsContainer.querySelector(`[data-card-id="${cardData.id}"]`);
            if (!cardDiv) {
                cardDiv = document.createElement("div");
                cardDiv.className = "card";
                cardDiv.draggable = true;
                // Append based on order later if needed, or rely on initial sort
            }
            cardDiv.dataset.cardId = cardData.id;
            cardDiv.dataset.originalBoardId = cardData.boardId; // Store original board for drag-drop logic

            const descriptionHTML = cardData.description ? cardData.description.replace(/\n/g, "<br>") : "";
            const timestamp = getFormattedTimestamp(cardData.updatedAt || cardData.createdAt);

            cardDiv.innerHTML = `
                <div class="card-header">
                    <h3 class="card-title-text">${cardData.title}</h3>
                    <div class="card-actions">
                        <button class="edit-card-btn" aria-label="Editar card">✏️</button>
                        <button class="delete-card-btn" aria-label="Excluir card">🗑️</button>
                    </div>
                </div>
                <p class="card-description-text">${descriptionHTML}</p>
                <span class="card-timestamp">${timestamp}</span>
            `;
            cardDiv.querySelector(".edit-card-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                openModalForCard(boardElement, cardData.boardId, cardDiv, cardData.id, cardData.title, cardData.description);
            });
            cardDiv.querySelector(".delete-card-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                deleteCard(cardData.id, cardData.title);
            });
            cardDiv.addEventListener("dragstart", DragDropManager.handleDragStart);
            cardDiv.addEventListener("dragend", DragDropManager.handleDragEnd);
            return cardDiv; // Return the element for sorting/appending
        }

        function listenForCardChanges(boardId, boardElement) {
            const cardsContainer = boardElement.querySelector(".cards-container");
            if (!cardsContainer) return;
            
            console.log(`CardManager: Setting up card display for board ${boardId} using localStorage`);
            const allCards = JSON.parse(localStorage.getItem("cards")) || [];
            cardsContainer.innerHTML = ""; // Clear before rendering
            
            const boardCards = allCards.filter(c => c.boardId === boardId)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            
            boardCards.forEach(cardData => {
                const cardElement = renderCard(cardData, boardElement);
                if (cardElement) cardsContainer.appendChild(cardElement);
            });
        }

        function init() {
            console.log("CardManager: Initializing...");
            if (DOMElements.saveCardBtn) DOMElements.saveCardBtn.addEventListener("click", saveCard);
            console.log("CardManager: Initialized.");
        }
        return { init, openModalForCard, renderCard, listenForCardChanges }; // Expose renderCard if needed elsewhere
    })();

    BoardManager = (() => {
        const FIXED_BOARDS_DATA = [
            { id: "board-todo", name: "À fazer" },
            { id: "board-inprogress", name: "Em progresso" },
            { id: "board-done", name: "Concluído" }
        ];

        function renderBoard(boardData) {
            if (!DOMElements.kanbanContainer) {
                console.error("BoardManager.renderBoard: kanbanContainer is null!");
                return;
            }
            console.log("BoardManager: Rendering board - Name:", boardData.name, "ID:", boardData.id);
            let boardDiv = DOMElements.kanbanContainer.querySelector(`[data-board-id="${boardData.id}"]`);
            if (!boardDiv) {
                boardDiv = document.createElement("div");
                boardDiv.className = "board";
                boardDiv.dataset.boardId = boardData.id;
                DOMElements.kanbanContainer.appendChild(boardDiv);
                console.log("BoardManager: Board div CREATED and appended for:", boardData.name);
            } else {
                console.log("BoardManager: Board div FOUND for:", boardData.name);
            }
            boardDiv.innerHTML = `
                <div class="board-header">
                    <h2 class="board-title">${boardData.name}</h2>
                </div>
                <div class="cards-container"></div>
                <button class="add-card-btn">+ Adicionar Card</button>
            `;
            boardDiv.querySelector(".add-card-btn").addEventListener("click", () => CardManager.openModalForCard(boardDiv, boardData.id));

            const cardsContainer = boardDiv.querySelector(".cards-container");
            if (cardsContainer) {
                DragDropManager.enableDropZone(cardsContainer, boardData.id);
                CardManager.listenForCardChanges(boardData.id, boardDiv);
            } else {
                console.error("BoardManager: Could not find .cards-container for board:", boardData.name);
            }
        }

        function initializeFixedBoards() {
            console.log("BoardManager: Initializing fixed boards...");
            if (!DOMElements.kanbanContainer) {
                console.error("BoardManager.initializeFixedBoards: kanbanContainer is null. Cannot initialize boards.");
                return;
            }
            DOMElements.kanbanContainer.innerHTML = "";

            console.log("BoardManager: Using localStorage for boards.");
            let storedBoards = JSON.parse(localStorage.getItem("boards")) || [];
            if (storedBoards.length === 0 || storedBoards.some((sb, i) => sb.id !== FIXED_BOARDS_DATA[i]?.id)) {
                console.log("BoardManager: Initializing/Resetting fixed boards in localStorage.");
                localStorage.setItem("boards", JSON.stringify(FIXED_BOARDS_DATA));
                storedBoards = FIXED_BOARDS_DATA;
            }
            storedBoards.forEach(boardData => renderBoard(boardData));
            console.log("BoardManager: Fixed boards initialization process completed.");
        }

        function init() {
            console.log("BoardManager: Initializing...");
            initializeFixedBoards(); // No need for await if it's all sync localStorage ops
            console.log("BoardManager: Initialized.");
        }
        return { init, renderBoard, FIXED_BOARDS: FIXED_BOARDS_DATA };
    })();

    function main() {
        console.log("Main function: Starting application initialization...");
        ThemeManager.init();
        ModalManager.init();
        BoardManager.init(); // BoardManager needs to be ready before CardManager tries to render into boards
        CardManager.init();
        console.log("Main function: Application initialization completed.");
    }

    main(); // No need for .catch if all async operations related to Firebase are removed
});

console.log("Script execution finished.");

