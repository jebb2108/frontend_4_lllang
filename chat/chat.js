const API_WS_URL = 'wss://chat.lllang.site';

// Получаем room_id и token из URL параметров
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room_id');
const token = urlParams.get('token');

if (!roomId || !token) {
    console.error('Room ID or Token missing');
}

// Переменные для хранения состояния
let userName = '';
let userInfoReceived = false;
let pendingMessages = [];
let sessionTimer;
let websocket;
let partnerConnected = false;
let waitTimer;

// Подключаемся к WebSocket серверу
function connectWebSocket() {
    const wsUrl = `${API_WS_URL}/ws/chat?room_id=${roomId}&token=${token}`;
    websocket = new WebSocket(wsUrl);

    websocket.onopen = function(event) {
        console.log('WebSocket connection established');
        
        // Показываем интерфейс ожидания
        showWaitingInterface();
        
        // Устанавливаем таймер блокировки чата через 15 минут
        sessionTimer = setTimeout(() => {
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

    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };

    websocket.onclose = function(event) {
        console.log('WebSocket connection closed:', event.code, event.reason);
        // Переподключение через 3 секунды
        setTimeout(connectWebSocket, 3000);
    };
}

// Показать интерфейс ожидания
function showWaitingInterface() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = `
        <div class="system-message">
            Chat started. Messages will disappear in 15 minutes
        </div>
    `;
    
    // Запускаем таймер ожидания
    startWaitTimer();
}

// Запуск таймера ожидания
function startWaitTimer() {
    let timeLeft = 30;
    const timerElement = document.getElementById('waitingTimer');
    
    waitTimer = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(waitTimer);
            endSession('Waiting time expired');
        }
    }, 1000);
}

// Переключение на интерфейс чата
function switchToChatInterface(partnerName) {
    // Скрываем интерфейс ожидания
    document.querySelector('.waiting-header').style.display = 'none';
    document.getElementById('waitingContainer').style.display = 'none';
    
    // Показываем интерфейс чата
    document.querySelector('.connected-header').style.display = 'flex';
    document.getElementById('partnerNickname').textContent = partnerName || 'Partner';
    
    // Очищаем таймер ожидания
    if (waitTimer) {
        clearInterval(waitTimer);
    }
    
    partnerConnected = true;
}

// Обработчик сообщений от сервера
function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'user_info':
            userName = data.username;
            userInfoReceived = true;
            
            // Обрабатываем сообщения, которые пришли до получения информации о пользователе
            processPendingMessages();
            break;
            
        case 'message_history':
            const container = document.getElementById('messagesContainer');
            
            // Проверяем, есть ли сообщения от других пользователей
            const hasOtherUsers = data.messages.some(msg => msg.sender !== userName);
            if (hasOtherUsers && !partnerConnected) {
                switchToChatInterface(data.messages.find(msg => msg.sender !== userName)?.sender);
            }
            
            if (userInfoReceived) {
                container.innerHTML = '';
                data.messages.forEach(msg => {
                    addMessageToChat(msg, msg.sender === userName);
                });
            } else {
                pendingMessages = data.messages;
            }
            break;
            
        case 'new_message':
            // Если это первое сообщение от другого пользователя, переключаем интерфейс
            if (data.message.sender !== userName && !partnerConnected) {
                switchToChatInterface(data.message.sender);
            }
            
            if (userInfoReceived) {
                addMessageToChat(data.message, data.message.sender === userName);
            } else {
                pendingMessages.push(data.message);
            }
            break;
            
        case 'session_ended':
            endSession();
            
            // Очищаем таймер, так как сессия уже завершена
            if (sessionTimer) {
                clearTimeout(sessionTimer);
            }
            break;
            
        case 'user_joined':
            // Если другой пользователь присоединился, переключаем интерфейс
            if (!partnerConnected) {
                switchToChatInterface(data.username);
            }
            break;
    }
}

// Функция для обработки ожидающих сообщений
function processPendingMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (pendingMessages.length > 0) {
        // Проверяем, есть ли сообщения от других пользователей
        const hasOtherUsers = pendingMessages.some(msg => msg.sender !== userName);
        if (hasOtherUsers && !partnerConnected) {
            switchToChatInterface(pendingMessages.find(msg => msg.sender !== userName)?.sender);
        }
        
        container.innerHTML = '';
        
        pendingMessages.forEach(msg => {
            addMessageToChat(msg, msg.sender === userName);
        });
        
        pendingMessages = [];
    }
}

// Функция завершения сессии
function endSession(reason) {
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendButton').disabled = true;

    const container = document.getElementById('messagesContainer');
    const sessionEndedMessage = document.createElement('div');
    sessionEndedMessage.className = 'session-ended-message';
    sessionEndedMessage.textContent = reason || 'Сессия завершена. Чат заблокирован.';
    container.appendChild(sessionEndedMessage);
    container.scrollTop = container.scrollHeight;
}

// Функция добавления сообщения в чат
function addMessageToChat(messageData, isMyMessage = false) {
    const container = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;

    let messageTime;
    const date = new Date(messageData.created_at);
    
    if (isNaN(date.getTime())) {
        console.error("Invalid date:", messageData.created_at);
        messageTime = "только что";
    } else {
        messageTime = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text">${messageData.text}</div>
            <div class="message-time">${messageTime}</div>
        </div>
    `;

    container.appendChild(messageDiv);
    // Прокручиваем к последнему сообщению
    container.scrollTop = container.scrollHeight;
}

// Функция отправки сообщения
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (message && websocket && websocket.readyState === WebSocket.OPEN) {
        const messageData = {
            text: message
        };
        websocket.send(JSON.stringify(messageData));
        messageInput.value = '';
    }
}

// Функции для меню
function handleReport() {
    alert('Report function will be implemented');
    // Закрываем меню
    document.querySelector('.dropdown-menu').classList.remove('show');
}

function handleExit() {
    if (confirm('Are you sure you want to exit the chat?')) {
        window.close();
    }
    document.querySelector('.dropdown-menu').classList.remove('show');
}

function goBack() {
    if (confirm('Are you sure you want to go back?')) {
        window.history.back();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Подключаем WebSocket
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
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', function() {
        document.querySelector('.dropdown-menu').classList.remove('show');
    });
    
    console.log('Chat initialized');
});