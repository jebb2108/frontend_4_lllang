const API_WS_URL = 'wss://chat.lllang.site';
const WORKER_API_URL = 'https://chat.lllang.site/api/worker'

// Получаем room_id и token из URL параметров
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('match_id');
const roomId = urlParams.get('room_id');
const token = urlParams.get('token');

if (!roomId || !token) {
    console.error('Room ID or Token missing');
}

// Переменные для хранения состояния
let userName = '';
let websocket;
let partnerConnected = false;
let timerInterval;
let partnerNickname = null;
let partnerDiscovered = false;

// Подключаемся к WebSocket серверу
function connectWebSocket() {
    const wsUrl = `${API_WS_URL}/ws/chat?room_id=${roomId}&token=${token}`;
    websocket = new WebSocket(wsUrl);

    websocket.onopen = function() {
        console.log('WebSocket connection established');
        showWaitingInterface();
        
        // Таймер блокировки чата через 15 минут
        setTimeout(() => {
            endSession();
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

    websocket.onclose = function() {
        console.log('WebSocket connection closed');
        setTimeout(connectWebSocket, 3000);
    };
}

// Функция для установки ника партнера
function setPartnerNickname(nickname) {
    if (nickname && nickname !== userName && !partnerDiscovered) {
        partnerNickname = nickname;
        partnerDiscovered = true;
        document.getElementById('partnerNickname').textContent = nickname;
        console.log('Partner nickname set to:', nickname);
    }
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
}

// Переключение на интерфейс чата
function switchToChatInterface(partnerName) {
    // Скрываем интерфейс ожидания
    document.querySelector('.waiting-header').style.display = 'none';
    document.getElementById('waitingContainer').style.display = 'none';
    
    // Показываем интерфейс чата
    document.querySelector('.connected-header').style.display = 'flex';
    document.querySelector('.input-container').style.display = 'flex';
    
    // Обновляем имя партнера (гарантированно)
    if (partnerName) {
        document.getElementById('partnerNickname').textContent = partnerName;
    } else if (partnerNickname) {
        document.getElementById('partnerNickname').textContent = partnerNickname;
    }
    
    // Устанавливаем статус партнера в онлайн
    updatePartnerStatus(true);
    
    // Очищаем таймер ожидания
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    partnerConnected = true;
}

// Обработчик сообщений от сервера
function handleWebSocketMessage(data) {
    console.log('Received WebSocket message:', data);
    
    switch(data.type) {
        case 'user_info':
            userName = data.username;
            break;
            
        case 'message_history':
            // Если есть сообщения от других пользователей, переключаем интерфейс
            const otherMessages = data.messages.filter(msg => msg.sender !== userName);
            if (otherMessages.length > 0 && !partnerConnected) {
                // Берем ник из первого сообщения другого пользователя
                setPartnerNickname(otherMessages[0].sender);
                switchToChatInterface(partnerNickname);
            }
            
            // Отображаем историю сообщений
            data.messages.forEach(msg => {
                addMessageToChat(msg, msg.sender === userName);
            });
            break;
            
        case 'new_message':
            // Устанавливаем ник отправителя как партнера
            if (data.message.sender !== userName) {
                setPartnerNickname(data.message.sender);
                if (!partnerConnected) {
                    switchToChatInterface(partnerNickname);
                }
            }
            
            addMessageToChat(data.message, data.message.sender === userName);
            break;
            
        case 'partner_status':
            updatePartnerStatus(data.is_online);
            if (data.is_online && !partnerConnected) {
                switchToChatInterface(partnerNickname || 'Partner');
            }
            break;

        case 'user_status':
            if (data.username !== userName) {
                setPartnerNickname(data.username);
                updatePartnerStatus(data.is_online);
                if (data.is_online && !partnerConnected) {
                    switchToChatInterface(partnerNickname);
                }
            }
            break;

        case 'online_users':
            const otherUsers = data.users.filter(user => user !== userName);
            if (otherUsers.length > 0) {
                // Берем первого онлайн пользователя как партнера
                setPartnerNickname(otherUsers[0]);
                if (!partnerConnected) {
                    switchToChatInterface(partnerNickname);
                }
            }
            break;
    }
}

// Функция завершения сессии
function endSession(reason) {
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendButton').disabled = true;

    const container = document.getElementById('messagesContainer');
    const sessionEndedMessage = document.createElement('div');
    sessionEndedMessage.className = 'session-ended-message';
    sessionEndedMessage.textContent = reason || 'Session ended. Chat is locked.';
    container.appendChild(sessionEndedMessage);
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

    // Определяем, короткое ли сообщение (примерно одна строка)
    setTimeout(() => {
        const textHeight = messageText.offsetHeight;
        const lineHeight = parseInt(getComputedStyle(messageText).lineHeight);
        const isShortMessage = textHeight <= lineHeight * 1.5;
        
        if (isShortMessage) {
            messageContent.classList.add('short-message');
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

function handleExit() {
    if (confirm('Are you sure you want to exit the chat?')) {
        window.history.back();
    }
}

async function goBack() {
    if (confirm('Are you sure you want to leave?')) {
        try { 
            const response = await fetch(`${WORKER_API_URL}/cancel_match?match_id=${matchId}`)
            if (response.ok) {
                window.history.back();
            }
        } catch (error) {
            console.error('Error going back to queue:', error);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    connectWebSocket();
    
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
        document.querySelector('.dropdown-menu').classList.remove('show');
    });
    
    document.addEventListener('click', function() {
        document.querySelector('.dropdown-menu').classList.remove('show');
    });
});