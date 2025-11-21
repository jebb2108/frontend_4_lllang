const API_WS_URL = 'wss://chat.lllang.site';
const WORKER_API_URL = 'https://chat.lllang.site/api/worker';

// Немедленно получаем и сохраняем параметры при загрузке скрипта
function getChatParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = {
        matchId: urlParams.get('match_id'),
        roomId: urlParams.get('room_id'),
        token: urlParams.get('token')
    };
    
    console.log('URL Parameters:', params);
    
    // Сохраняем в sessionStorage как резервную копию
    if (params.matchId) sessionStorage.setItem('matchId', params.matchId);
    if (params.roomId) sessionStorage.setItem('roomId', params.roomId);
    if (params.token) sessionStorage.setItem('token', params.token);
    
    return params;
}

// Получаем параметры сразу
const CHAT_PARAMS = getChatParams();

// Переменные состояния
let userName = '';
let websocket = null;
let partnerConnected = false;
let timerInterval = null;
let partnerNickname = null;

// Главная функция инициализации
function initChat() {
    console.log('Initializing chat with:', CHAT_PARAMS);
    
    if (!CHAT_PARAMS.roomId || !CHAT_PARAMS.token) {
        showError('Missing required parameters');
        return;
    }
    
    setupEventListeners();
    connectWebSocket();
}

function showError(message) {
    const container = document.getElementById('messagesContainer');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'session-ended-message';
    errorDiv.textContent = message;
    container.appendChild(errorDiv);
    document.getElementById('waitingContainer').style.display = 'none';
}

function connectWebSocket() {
    const wsUrl = `${API_WS_URL}/ws/chat?room_id=${CHAT_PARAMS.roomId}&token=${CHAT_PARAMS.token}`;
    console.log('Connecting to:', wsUrl);
    
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log('WebSocket connected');
        showWaitingInterface();
        
        // Таймер блокировки чата
        setTimeout(() => endSession('Chat session expired'), 900000);
    };

    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Received:', data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Parse error:', error);
        }
    };

    websocket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function showWaitingInterface() {
    document.getElementById('waitingContainer').style.display = 'flex';
    startWaitTimer();
}

function startWaitTimer() {
    let timeLeft = 30;
    const timerElement = document.getElementById('waitingTimer');
    const progressCircle = document.querySelector('.timer-progress');
    const circumference = 2 * Math.PI * 54;
    
    // Очищаем предыдущий таймер
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Немедленно обновляем отображение
    timerElement.textContent = timeLeft;
    progressCircle.style.strokeDashoffset = 0;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        
        const offset = circumference - (timeLeft / 30) * circumference;
        progressCircle.style.strokeDashoffset = offset;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            endSession('No partner found');
        }
    }, 1000);
}

function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'user_info':
            userName = data.username;
            console.log('User identified:', userName);
            break;
            
        case 'message_history':
            processMessageHistory(data.messages);
            break;
            
        case 'new_message':
            processNewMessage(data.message);
            break;
            
        case 'user_status':
            if (data.username !== userName) {
                handlePartnerStatus(data.username, data.is_online);
            }
            break;

        case 'online_users':
            handleOnlineUsers(data.users);
            break;
            
        case 'partner_status':
            updatePartnerStatus(data.is_online);
            break;
    }
}

function processMessageHistory(messages) {
    messages.forEach(msg => {
        addMessageToChat(msg, msg.sender === userName);
        
        // Если есть сообщения от других пользователей - это наш партнер
        if (msg.sender !== userName && !partnerNickname) {
            setPartnerNickname(msg.sender);
            switchToChatInterface();
        }
    });
}

function processNewMessage(message) {
    // Если это сообщение от другого пользователя - это наш партнер
    if (message.sender !== userName && !partnerNickname) {
        setPartnerNickname(message.sender);
        switchToChatInterface();
    }
    
    addMessageToChat(message, message.sender === userName);
}

function handlePartnerStatus(username, isOnline) {
    if (!partnerNickname) {
        setPartnerNickname(username);
        switchToChatInterface();
    }
    updatePartnerStatus(isOnline);
}

function handleOnlineUsers(users) {
    const otherUsers = users.filter(user => user !== userName);
    if (otherUsers.length > 0 && !partnerNickname) {
        setPartnerNickname(otherUsers[0]);
        switchToChatInterface();
    }
}

function setPartnerNickname(nickname) {
    partnerNickname = nickname;
    document.getElementById('partnerNickname').textContent = nickname;
    console.log('Partner set to:', nickname);
}

function updatePartnerStatus(isOnline) {
    const statusElement = document.getElementById('partnerStatus');
    if (statusElement) {
        statusElement.className = isOnline ? 'status-indicator online' : 'status-indicator offline';
    }
}

function switchToChatInterface() {
    console.log('Switching to chat interface');
    
    // Скрываем ожидание
    document.querySelector('.waiting-header').style.display = 'none';
    document.getElementById('waitingContainer').style.display = 'none';
    
    // Показываем чат
    document.querySelector('.connected-header').style.display = 'flex';
    document.querySelector('.input-container').style.display = 'flex';
    
    // Обновляем статус
    updatePartnerStatus(true);
    
    // Останавливаем таймер ожидания
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    partnerConnected = true;
}

function endSession(reason) {
    console.log('Session ended:', reason);
    
    if (websocket) {
        websocket.close(1000, "Session ended");
    }
    
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (messageInput) messageInput.disabled = true;
    if (sendButton) sendButton.disabled = true;

    const container = document.getElementById('messagesContainer');
    const sessionEndedMessage = document.createElement('div');
    sessionEndedMessage.className = 'session-ended-message';
    sessionEndedMessage.textContent = reason || 'Session ended';
    container.appendChild(sessionEndedMessage);
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function addMessageToChat(messageData, isMyMessage = false) {
    const container = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;

    const messageTime = getMessageTime(messageData.created_at);

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

    // Определяем короткое ли сообщение
    setTimeout(() => {
        const textHeight = messageText.offsetHeight;
        const lineHeight = parseFloat(getComputedStyle(messageText).lineHeight);
        const isShortMessage = textHeight <= lineHeight * 1.5;
        
        if (isShortMessage) {
            messageContent.classList.add('short-message');
        }
    }, 0);
}

function getMessageTime(createdAt) {
    const date = new Date(createdAt);
    return isNaN(date.getTime()) ? "now" : 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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
    const matchId = CHAT_PARAMS.matchId || sessionStorage.getItem('matchId');
    console.log('Exit with matchId:', matchId);
    
    if (!matchId) {
        alert('Error: Match ID not found');
        return;
    }
    
    if (confirm('Are you sure you want to exit the chat?')) {
        try {
            const response = await fetch(
                `${WORKER_API_URL}/cancel_match?match_id=${matchId}&is_aborted=false`
            );
            
            if (response.ok) {
                window.history.back();
            } else {
                alert('Failed to exit chat');
            }
        } catch (error) {
            console.error('Exit error:', error);
            alert('Error exiting chat');
        }
    }
    document.querySelector('.dropdown-menu').classList.remove('show');
}

async function goBack() {
    const matchId = CHAT_PARAMS.matchId || sessionStorage.getItem('matchId');
    console.log('Go back with matchId:', matchId);
    
    if (!matchId) {
        alert('Error: Match ID not found');
        return;
    }
    
    if (confirm('Are you sure you want to leave?')) {
        try {
            const response = await fetch(
                `${WORKER_API_URL}/cancel_match?match_id=${matchId}&is_aborted=true`
            );
            
            if (response.ok) {
                window.history.back();
            } else {
                alert('Failed to leave');
            }
        } catch (error) {
            console.error('Go back error:', error);
            alert('Error leaving');
        }
    }
}

function setupEventListeners() {
    // Отправка сообщений
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    // Меню
    document.querySelector('.menu-dots').addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.dropdown-menu').classList.toggle('show');
    });
    
    document.getElementById('exitButton').addEventListener('click', (e) => {
        e.stopPropagation();
        handleExit();
    });
    
    document.querySelector('.cancel-button').addEventListener('click', goBack);
    
    document.addEventListener('click', () => {
        document.querySelector('.dropdown-menu').classList.remove('show');
    });
}

// Запускаем при загрузке DOM
document.addEventListener('DOMContentLoaded', initChat);