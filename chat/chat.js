const API_WS_URL = 'wss://chat.lllang.site';
const WORKER_API_URL = 'https://chat.lllang.site/api/worker';

// Немедленно получаем параметры при загрузке скрипта
const urlParams = new URLSearchParams(window.location.search);
const MATCH_ID = urlParams.get('match_id');
const ROOM_ID = urlParams.get('room_id');
const TOKEN = urlParams.get('token');

console.log('URL Parameters on load:', { MATCH_ID, ROOM_ID, TOKEN });

// Сохраняем в глобальной области видимости для надежности
window.CHAT_PARAMS = {
    matchId: MATCH_ID,
    roomId: ROOM_ID,
    token: TOKEN
};

// Переменные состояния чата
let userName = '';
let websocket = null;
let partnerConnected = false;
let timerInterval = null;
let partnerNickname = null;
let partnerDiscovered = false;

// Основная функция инициализации
function initializeChat() {
    console.log('Initializing chat with params:', window.CHAT_PARAMS);
    
    if (!window.CHAT_PARAMS.roomId || !window.CHAT_PARAMS.token) {
        console.error('Missing required parameters');
        showError('Missing required parameters. Please return to main page.');
        return;
    }
    
    connectWebSocket();
    setupEventListeners();
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
    const { roomId, token } = window.CHAT_PARAMS;
    
    if (!roomId || !token) {
        console.error('Cannot connect: missing roomId or token');
        return;
    }
    
    const wsUrl = `${API_WS_URL}/ws/chat?room_id=${roomId}&token=${token}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log('WebSocket connection established');
        showWaitingInterface();
    };

    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing message:', error);
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
    
    // Немедленно очищаем предыдущий таймер
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Немедленно обновляем отображение
    timerElement.textContent = timeLeft;
    progressCircle.style.strokeDashoffset = 0;
    
    // Запускаем таймер без задержки
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        
        const offset = circumference - (timeLeft / 30) * circumference;
        progressCircle.style.strokeDashoffset = offset;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            endSession('No partner found. Please try again.');
        }
    }, 1000);
}

function updatePartnerStatus(isOnline) {
    const statusElement = document.getElementById('partnerStatus');
    if (statusElement) {
        statusElement.className = isOnline ? 'status-indicator online' : 'status-indicator offline';
    }
}

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
}

function handleWebSocketMessage(data) {
    console.log('WebSocket message:', data);
    
    switch(data.type) {
        case 'user_info':
            userName = data.username;
            break;
            
        case 'message_history':
            data.messages.forEach(msg => {
                addMessageToChat(msg, msg.sender === userName);
                if (msg.sender !== userName && !partnerDiscovered) {
                    setPartnerNickname(msg.sender);
                }
            });
            
            if (data.messages.some(msg => msg.sender !== userName) && !partnerConnected) {
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

function setPartnerNickname(nickname) {
    if (nickname && nickname !== userName) {
        partnerNickname = nickname;
        document.getElementById('partnerNickname').textContent = nickname;
        
        if (!partnerConnected) {
            switchToChatInterface();
        }
        return true;
    }
    return false;
}

function endSession(reason) {
    console.log('Ending session:', reason);
    
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
    sessionEndedMessage.textContent = reason || 'Session ended. Chat is locked.';
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

    // Определяем, короткое ли сообщение
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
    const matchId = window.CHAT_PARAMS.matchId;
    console.log('Exit clicked, matchId:', matchId);
    
    if (!matchId) {
        alert('Error: Match ID not found. Please check URL parameters.');
        console.error('Match ID is null or undefined');
        return;
    }
    
    if (confirm('Are you sure you want to exit the chat?')) {
        try {
            console.log('Sending exit request with matchId:', matchId);
            const url = `${WORKER_API_URL}/cancel_match?match_id=${matchId}&is_aborted=false`;
            console.log('Request URL:', url);
            
            const response = await fetch(url);
            
            if (response.ok) {
                console.log('Exit successful');
                window.history.back();
            } else {
                console.error('Failed to exit:', response.status);
                alert('Failed to exit chat. Please try again.');
            }
        } catch (error) {
            console.error('Error exiting chat:', error);
            alert('Error exiting chat. Please try again.');
        }
    }
    document.querySelector('.dropdown-menu').classList.remove('show');
}

async function goBack() {
    const matchId = window.CHAT_PARAMS.matchId;
    console.log('Go back clicked, matchId:', matchId);
    
    if (!matchId) {
        alert('Error: Match ID not found. Please check URL parameters.');
        console.error('Match ID is null or undefined');
        return;
    }
    
    if (confirm('Are you sure you want to leave?')) {
        try {
            console.log('Sending cancel request with matchId:', matchId);
            const url = `${WORKER_API_URL}/cancel_match?match_id=${matchId}&is_aborted=true`;
            console.log('Request URL:', url);
            
            const response = await fetch(url);
            
            if (response.ok) {
                console.log('Cancel successful');
                window.history.back();
            } else {
                console.error('Failed to cancel:', response.status);
                alert('Failed to leave. Please try again.');
            }
        } catch (error) {
            console.error('Error leaving:', error);
            alert('Error leaving. Please try again.');
        }
    }
}

function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    // Обработчик для выпадающего меню
    document.querySelector('.menu-dots').addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.dropdown-menu').classList.toggle('show');
    });
    
    // Обработчик для кнопки Exit
    document.getElementById('exitButton').addEventListener('click', (e) => {
        e.stopPropagation();
        handleExit();
    });
    
    // Обработчик для кнопки Cancel
    document.querySelector('.cancel-button').addEventListener('click', goBack);
    
    document.addEventListener('click', () => {
        document.querySelector('.dropdown-menu').classList.remove('show');
    });
}

// Запускаем инициализацию сразу после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting chat initialization...');
    initializeChat();
});

// Также запускаем инициализацию при полной загрузке страницы
window.addEventListener('load', () => {
    console.log('Page fully loaded');
});