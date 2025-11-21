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

// Подключаемся к WebSocket серверу
function connectWebSocket() {
    const wsUrl = `${API_WS_URL}/ws/chat?room_id=${roomId}&token=${token}`;
    websocket = new WebSocket(wsUrl);

    websocket.onopen = function(event) {
        console.log('WebSocket connection established');
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
            container.innerHTML = '';

            if (userInfoReceived) {
                data.messages.forEach(msg => {
                    addMessageToChat(msg, msg.sender === userName);
                });
            } else {
                pendingMessages = data.messages;
            }
            break;
            
        case 'new_message':
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
    }
}

// Функция для обработки ожидающих сообщений
function processPendingMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (pendingMessages.length > 0) {
        container.innerHTML = '';
        
        pendingMessages.forEach(msg => {
            addMessageToChat(msg, msg.sender === userName);
        });
        
        pendingMessages = [];
    }
}

// Функция завершения сессии
function endSession() {
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendButton').disabled = true;

    const container = document.getElementById('messagesContainer');
    const sessionEndedMessage = document.createElement('div');
    sessionEndedMessage.className = 'session-ended-message';
    sessionEndedMessage.textContent = 'Сессия завершена. Чат заблокирован.';
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
    
    if (isNaN(date.getTime())) { // Проверка на Invalid Date
        console.error("Invalid date:", messageData.created_at);
        messageTime = "только что";
    } else {
        messageTime = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    messageDiv.innerHTML = `
        <div class="message-content">${messageData.text}</div>
        <div class="message-info">
            ${isMyMessage ? 'Вы' : messageData.sender} • ${messageTime}
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
        // Отправляем сообщение как объект с полем text (аналогично socket.emit('send_message', message))
        const messageData = {
            text: message
        };
        websocket.send(JSON.stringify(messageData));
        messageInput.value = '';
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
        // Отправка сообщения при нажатии Enter
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    if (sendButton) {
        // Отправка сообщения при клике на кнопку
        sendButton.addEventListener('click', sendMessage);
    }
    
    console.log('Chat initialized');
});