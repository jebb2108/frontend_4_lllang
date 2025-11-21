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
            processPendingMessages();
            break;
            
        case 'message_history':
            if (userInfoReceived) {
                const container = document.getElementById('messagesContainer');
                container.innerHTML = '';
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
            if (sessionTimer) {
                clearTimeout(sessionTimer);
            }
            break;
    }
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

// Инициализация WebSocket при загрузке
connectWebSocket();

// Устанавливаем таймер блокировки чата через 15 минут
sessionTimer = setTimeout(() => {
    endSession();
}, 900000);

// Остальной код остается таким же...