const API_WS_URL = 'wss://chat.lllang.site';
const WORKER_API_URL = 'https://chat.lllang.site/api/worker';

// Глобальные переменные для параметров
let appMatchId = null;
let appRoomId = null;
let appToken = null;

// Функция инициализации параметров
function initializeAppParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    appMatchId = urlParams.get('match_id');
    appRoomId = urlParams.get('room_id');
    appToken = urlParams.get('token');
    
    console.log('Initialized app params:', {
        matchId: appMatchId,
        roomId: appRoomId,
        token: appToken
    });
    
    // Сохраняем в sessionStorage как резервную копию
    if (appMatchId) sessionStorage.setItem('appMatchId', appMatchId);
    if (appRoomId) sessionStorage.setItem('appRoomId', appRoomId);
    if (appToken) sessionStorage.setItem('appToken', appToken);
    
    // Проверяем наличие обязательных параметров
    if (!appRoomId || !appToken) {
        console.error('Missing required parameters:', { roomId: appRoomId, token: appToken });
        alert('Error: Missing required parameters. Please return to the main page.');
        return false;
    }
    
    return true;
}

// Функции для получения параметров с fallback
function getMatchId() {
    return appMatchId || sessionStorage.getItem('appMatchId');
}

function getRoomId() {
    return appRoomId || sessionStorage.getItem('appRoomId');
}

function getToken() {
    return appToken || sessionStorage.getItem('appToken');
}

// Переменные для хранения состояния чата
let userName = '';
let websocket = null;
let partnerConnected = false;
let timerInterval = null;
let partnerNickname = null;
let partnerDiscovered = false;

// Подключаемся к WebSocket серверу
function connectWebSocket() {
    const currentRoomId = getRoomId();
    const currentToken = getToken();
    
    if (!currentRoomId || !currentToken) {
        console.error('Cannot connect: Missing roomId or token');
        alert('Cannot connect to chat. Missing required parameters.');
        return;
    }
    
    const wsUrl = `${API_WS_URL}/ws/chat?room_id=${currentRoomId}&token=${currentToken}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    websocket = new WebSocket(wsUrl);

    websocket.onopen = function() {
        console.log('WebSocket connection established');
        showWaitingInterface();
        
        // Таймер блокировки чата через 15 минут
        setTimeout(() => {
            endSession('Chat session expired');
        }, 900000);
    };

    websocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    websocket.onclose = function(event) {
        console.log('WebSocket connection closed:', event.code, event.reason);
        if (event.code !== 1000) {
            setTimeout(() => {
                if (!partnerConnected) {
                    connectWebSocket();
                }
            }, 3000);
        }
    };

    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

// Функция для установки ника партнера
function setPartnerNickname(nickname) {
    if (nickname && nickname !== userName) {
        partnerNickname = nickname;
        document.getElementById('partnerNickname').textContent = nickname;
        console.log('Partner nickname set to:', nickname);
        
        if (!partnerConnected) {
            switchToChatInterface();
        }
        return true;
    }
    return false;
}

// Показать интерфейс ожидания
function showWaitingInterface() {
    document.getElementById('waitingContainer').style.display = 'flex';
    startWaitTimer();
}

// Запуск таймера ожидания
function startWaitTimer() {
    let timeLeft = 30;
    const timerElement = document.getElementById('waitingTimer');
    const progressCircle = document.querySelector('.timer-progress');
    const circumference = 2 * Math.PI * 54;
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    const updateProgress = () => {
        const offset = circumference - (timeLeft / 30) * circumference;
        progressCircle.style.strokeDashoffset = offset;
    };
    
    updateProgress();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        updateProgress();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endSession('No partner found. Please try again.');
        }
    }, 1000);
}

// Обновление статуса партнера
function updatePartnerStatus(isOnline) {
    const partnerStatusElement = document.getElementById('partnerStatus');
    if (partnerStatusElement) {
        partnerStatusElement.className = isOnline ? 'status-indicator online' : 'status-indicator offline';
    }
    
    if (isOnline && !partnerNickname && !partnerConnected) {
        switchToChatInterface();
    }
}

// Переключение на интерфейс чата
function switchToChatInterface() {
    document.querySelector('.waiting-header').style.display = 'none';
    document.getElementById('waitingContainer').style.display = 'none';
    
    document.querySelector('.connected-header').style.display = 'flex';
    document.querySelector('.input-container').style.display = 'flex';
    
    if (partnerNickname) {
        document.getElementById('partnerNickname').textContent = partnerNickname;
    }
    
    updatePartnerStatus(true);
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    partnerConnected = true;
    partnerDiscovered = true;
    
    console.log('Switched to chat interface');
}

// Обработчик сообщений от сервера
function handleWebSocketMessage(data) {
    console.log('Received WebSocket message:', data);
    
    switch(data.type) {
        case 'user_info':
            userName = data.username;
            console.log('User identified as:', userName);
            break;
            
        case 'message_history':
            data.messages.forEach(msg => {
                addMessageToChat(msg, msg.sender === userName);
                
                if (msg.sender !== userName && !partnerDiscovered) {
                    setPartnerNickname(msg.sender);
                }
            });
            
            const hasPartnerMessages = data.messages.some(msg => msg.sender !== userName);
            if (hasPartnerMessages && !partnerConnected) {
                switchToChatInterface();
            }
            break;
            
        case 'new_message':
            if (data.message.sender !== userName && !partnerDiscovered) {
                setPartnerNickname(data.message.sender);
            }
            
            addMessageToChat(data.message, data.message.sender === userName);
            
            if (data.message.sender !== userName && !partnerConnected) {
                switchToChatInterface();
            }
            break;
            
        case 'partner_status':
            updatePartnerStatus(data.is_online);
            break;

        case 'user_status':
            if (data.username !== userName) {
                if (!partnerDiscovered) {
                    setPartnerNickname(data.username);
                }
                updatePartnerStatus(data.is_online);
            }
            break;

        case 'online_users':
            const otherUsers = data.users.filter(user => user !== userName);
            if (otherUsers.length > 0 && !partnerDiscovered) {
                setPartnerNickname(otherUsers[0]);
            }
            break;
    }
}

// Функция завершения сессии
function endSession(reason) {
    console.log('Ending session:', reason);
    
    if (websocket) {
        websocket.close(1000, "Session ended");
    }
    
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendButton').disabled = true;

    const container = document.getElementById('messagesContainer');
    const sessionEndedMessage = document.createElement('div');
    sessionEndedMessage.className = 'session-ended-message';
    sessionEndedMessage.textContent = reason || 'Session ended. Chat is locked.';
    container.appendChild(sessionEndedMessage);
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Функция добавления сообщения в чат
function addMessageToChat(messageData, isMyMessage = false) {
    const container = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;

    let messageTime;
    const date = new Date(messageData.created_at);
    
    if (isNaN(date.getTime())) {
        messageTime = "now";
    } else {
        messageTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = messageData.text;

    const messageTimeElement = document.createElement('div');
    messageTimeElement.className = 'message-time';
    messageTimeElement.textContent = messageTime;

    messageContent.appendChild(messageText);
    messageContent.appendChild(messageTimeElement);
    messageDiv.appendChild(messageContent);

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;

    // Определяем, короткое ли сообщение (одна строка)
    setTimeout(() => {
        const textHeight = messageText.offsetHeight;
        const lineHeight = parseFloat(getComputedStyle(messageText).lineHeight);
        const isShortMessage = textHeight <= lineHeight * 1.5;
        
        if (isShortMessage) {
            messageContent.classList.add('short-message');
        } else {
            messageContent.classList.remove('short-message');
        }
    }, 0);
}

// Функция отправки сообщения
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (message && websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ text: message }));
        messageInput.value = '';
    }
}

// Функции для меню
function handleReport() {
    alert('Report function will be implemented');
    document.querySelector('.dropdown-menu').classList.remove('show');
}

async function handleExit() {
    const currentMatchId = getMatchId();
    console.log('Exit clicked, matchId:', currentMatchId);
    
    if (!currentMatchId) {
        alert('Error: Match ID not found. Please check the URL parameters.');
        console.error('Match ID is null or undefined');
        return;
    }
    
    if (confirm('Are you sure you want to exit the chat?')) {
        try {
            console.log('Sending exit request with matchId:', currentMatchId);
            const response = await fetch(`${WORKER_API_URL}/cancel_match?match_id=${currentMatchId}&is_aborted=false`);
            
            if (response.ok) {
                console.log('Exit request successful');
                // Очищаем sessionStorage перед выходом
                sessionStorage.removeItem('appMatchId');
                sessionStorage.removeItem('appRoomId');
                sessionStorage.removeItem('appToken');
                window.history.back();
            } else {
                const errorText = await response.text();
                console.error('Failed to cancel match:', response.status, errorText);
                alert(`Failed to exit chat: ${response.status}. Please try again.`);
            }
        } catch (error) {
            console.error('Error exiting chat:', error);
            alert('Error exiting chat. Please try again.');
        }
    }
    document.querySelector('.dropdown-menu').classList.remove('show');
}

async function goBack() {
    const currentMatchId = getMatchId();
    console.log('Go back clicked, matchId:', currentMatchId);
    
    if (!currentMatchId) {
        alert('Error: Match ID not found. Please check the URL parameters.');
        console.error('Match ID is null or undefined');
        return;
    }
    
    if (confirm('Are you sure you want to leave?')) {
        try {
            console.log('Sending cancel request with matchId:', currentMatchId);
            const response = await fetch(`${WORKER_API_URL}/cancel_match?match_id=${currentMatchId}&is_aborted=true`);
            
            if (response.ok) {
                console.log('Cancel request successful');
                // Очищаем sessionStorage перед выходом
                sessionStorage.removeItem('appMatchId');
                sessionStorage.removeItem('appRoomId');
                sessionStorage.removeItem('appToken');
                window.history.back();
            } else {
                const errorText = await response.text();
                console.error('Failed to cancel match:', response.status, errorText);
                alert(`Failed to leave: ${response.status}. Please try again.`);
            }
        } catch (error) {
            console.error('Error going back to queue:', error);
            alert('Error leaving. Please try again.');
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    
    // Инициализируем параметры приложения
    if (!initializeAppParams()) {
        // Если параметры не валидны, показываем ошибку
        document.getElementById('waitingContainer').style.display = 'none';
        const container = document.getElementById('messagesContainer');
        const errorMessage = document.createElement('div');
        errorMessage.className = 'session-ended-message';
        errorMessage.textContent = 'Error: Invalid or missing parameters. Please return to the main page.';
        container.appendChild(errorMessage);
        return;
    }
    
    console.log('App params initialized successfully:', {
        matchId: getMatchId(),
        roomId: getRoomId(),
        token: getToken() ? '***' : 'missing'
    });
    
    // Подключаемся к WebSocket
    connectWebSocket();
    
    // Настраиваем обработчики событий
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    // Обработчик для выпадающего меню
    document.querySelector('.menu-dots').addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelector('.dropdown-menu').classList.toggle('show');
    });
    
    // Обработчик для кнопки Exit
    document.getElementById('exitButton').addEventListener('click', function(e) {
        e.stopPropagation();
        handleExit();
    });
    
    document.addEventListener('click', function() {
        document.querySelector('.dropdown-menu').classList.remove('show');
    });
    
    // Добавляем обработчик для кнопки Cancel в режиме ожидания
    document.querySelector('.cancel-button').addEventListener('click', goBack);
});