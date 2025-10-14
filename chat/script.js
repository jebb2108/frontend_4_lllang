const API_BASE_URL = window.location.origin || 'https://chat.lllang.site';

        // Массив креативных сообщений о поиске
        const searchMessages = [
            "Подбираем сладости к чаю...",
            "Практикуем произношение...",
            "Читаем газету на иностранном языке...",
            "Готовим фондю для душевной беседы...",
            "Собираем букет из интересных тем...",
            "Настраиваем языковые вибрации...",
            "Завариваем ароматный кофе для беседы...",
            "Перебираем словарный запас...",
            "Ищем общие интересы...",
            "Настраиваем атмосферу для комфортного общения...",
            "Подготавливаем интересные вопросы...",
            "Создаем уютную языковую среду...",
            "Подбираем идеальную пару для диалога...",
            "Наполняем чашу вдохновения...",
            "Готовим сюрпризы для беседы..."
        ];

        // Функции для извлечения user_id из Telegram WebApp
        async function getUserId() {
            let userId = null;
            
            // 1. Пробуем получить из Telegram WebApp
            userId = await getUserIdFromTelegram();
            
            // 2. Если не получилось, извлекаем из URL
            if (!userId) {
                userId = getUserIdFromURL();
            }
            
            return userId;
        }

        async function getUserIdFromTelegram() {
            return new Promise((resolve) => {
                if (window.Telegram?.WebApp) {
                    const tg = window.Telegram.WebApp;
                    tg.ready();
                    tg.expand();
                    
                    if (tg.initDataUnsafe?.user?.id) {
                        resolve(String(tg.initDataUnsafe.user.id));
                        return;
                    }
                }
                
                const script = document.createElement('script');
                script.src = 'https://telegram.org/js/telegram-web-app.js';
                script.onload = () => {
                    if (window.Telegram?.WebApp) {
                        const tg = window.Telegram.WebApp;
                        tg.ready();
                        tg.expand();
                        
                        if (tg.initDataUnsafe?.user?.id) {
                            resolve(String(tg.initDataUnsafe.user.id));
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                };
                script.onerror = () => {
                    resolve(null);
                };
                document.head.appendChild(script);
                
                setTimeout(() => {
                    resolve(null);
                }, 2000);
            });
        }

        function getUserIdFromURL() {
            try {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const tgWebAppData = hashParams.get('tgWebAppData');
                
                if (tgWebAppData) {
                    const dataParams = new URLSearchParams(tgWebAppData);
                    const userParam = dataParams.get('user');
                    
                    if (userParam) {
                        const decodedUser = decodeURIComponent(userParam);
                        const userData = JSON.parse(decodedUser);
                        
                        if (userData && userData.id) {
                            return String(userData.id);
                        }
                    }
                }
            } catch (error) {
                console.error('Ошибка при извлечении данных из URL:', error);
            }
            
            return null;
        }

        // Проверка существования пользователя в БД
        async function checkUserExists(userId) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/check_user?user_id=${encodeURIComponent(userId)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    return result.exists;
                }
                return false;
            } catch (error) {
                console.error('Ошибка проверки пользователя:', error);
                return false;
            }
        }

        // Логика комнаты ожидания
        let roomInitialized = false;
        let userInQueue = false;
        let currentQueueSize = 0;
        let isLoading = false;
        let searchMessageInterval = null;
        let currentMessageIndex = 0;
        
        const roomElements = {
            roomImage: document.getElementById('room-image'),
            userStatus: document.getElementById('user-status'),
            searchMessage: document.getElementById('search-message'),
            error: document.getElementById('room-error')
        };

        // Функция для смены сообщений поиска
        function startSearchMessages() {
            if (searchMessageInterval) {
                clearInterval(searchMessageInterval);
            }
            
            currentMessageIndex = 0;
            roomElements.searchMessage.textContent = searchMessages[currentMessageIndex];
            roomElements.searchMessage.style.opacity = '1';
            
            searchMessageInterval = setInterval(() => {
                currentMessageIndex = (currentMessageIndex + 1) % searchMessages.length;
                roomElements.searchMessage.style.opacity = '0';
                
                setTimeout(() => {
                    roomElements.searchMessage.textContent = searchMessages[currentMessageIndex];
                    roomElements.searchMessage.style.opacity = '1';
                }, 500);
            }, 3000);
        }

        function stopSearchMessages() {
            if (searchMessageInterval) {
                clearInterval(searchMessageInterval);
                searchMessageInterval = null;
            }
            // Плавно скрываем сообщение вместо резкого удаления
            roomElements.searchMessage.style.opacity = '0';
            setTimeout(() => {
                roomElements.searchMessage.textContent = '';
            }, 500);
        }


        async function initRoom() {
            if (roomInitialized) return;
            
            updateRoomImage(0);
            updateUserStatus();
            
            // Загружаем начальный статус пользователя
            await checkUserStatus();
            
            // Подключаем WebSocket для реальных обновлений
            connectWebSocket();
            
            // Периодически обновляем статус очереди
            setInterval(updateQueueData, 2000);
            
            roomInitialized = true;
        }

        async function checkUserStatus() {
            try {
                const userId = await getUserId();
                if (!userId) return;
                
                const response = await fetch(`${API_BASE_URL}/api/queue/user/${userId}/status`);
                if (response.ok) {
                    const data = await response.json();
                    userInQueue = data.in_queue;
                    updateUserStatus();
                    
                    if (userInQueue) {
                        startSearchMessages();
                    } else {
                        stopSearchMessages();
                    }
                }
            } catch (error) {
                console.error('Error checking user status:', error);
            }
        }

        async function toggleQueue() {
            if (isLoading) return;
            
            setIsLoading(true);
            
            try {
                const userId = await getUserId();
                if (!userId) {
                    throw new Error('Не удалось определить ID пользователя');
                }
                
                const action = userInQueue ? 'leave' : 'join';
                const response = await fetch(`${API_BASE_URL}/api/match/toggle`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        action: action
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    userInQueue = action === 'join';
                    updateUserStatus();
                    showError('');
                    
                    if (userInQueue) {
                        startSearchMessages();
                    } else {
                        stopSearchMessages();
                    }
                } else {
                    throw new Error(data.message || 'Unknown error');
                }
                
            } catch (error) {
                showError('Ошибка: ' + error.message);
                console.error('Error toggling queue:', error);
            } finally {
                setIsLoading(false);
            }
        }

        function setIsLoading(loading) {
            isLoading = loading;
            roomElements.roomImage.classList.toggle('loading', loading);
            if (loading) {
                roomElements.userStatus.textContent = 'Загрузка...';
            } else {
                updateUserStatus();
            }
        }

        function updateRoomImage(count) {
            // Используем заглушки для изображений - в реальном приложении замените на реальные пути
            if (count === 0) {
                roomElements.roomImage.src = 'media/empty_room.jpeg';
            } else if (count < 3) {
                roomElements.roomImage.src = 'media/half_full_room.jpeg';
            } else {
                roomElements.roomImage.src = 'media/full_room.jpeg';
            }
        }

        function updateUserStatus() {
            if (userInQueue) {
                roomElements.userStatus.textContent = 'Ты в очереди. Нажми на комнату чтобы выйти.';
                startSearchMessages(); // Запускаем сообщения при входе в очередь
            } else {
                roomElements.userStatus.textContent = 'Нажми на комнату для поиска собеседника';
                stopSearchMessages(); // Останавливаем и скрываем сообщения при выходе из очереди
            }
        }

        function showError(message) {
            roomElements.error.textContent = message;
        }

        async function updateQueueData() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/queue/status`);
                if (response.ok) {
                    const data = await response.json();
                    currentQueueSize = data.queue_size;
                    updateRoomImage(data.queue_size);
                }
            } catch (error) {
                console.error('Error updating queue data:', error);
            }
        }

        function connectWebSocket() {
            try {
                getUserId().then(userId => {
                    if (!userId) return;
                    
                    const ws = new WebSocket(`ws://localhost:8101/ws/queue?user_id=${userId}`);
                    
                    ws.onmessage = function(event) {
                        const data = JSON.parse(event.data);
                        if (data.type === 'queue_update') {
                            currentQueueSize = data.count;
                            updateRoomImage(data.count);
                        }
                    };
                    
                    ws.onerror = function(error) {
                        console.error('WebSocket error:', error);
                    };
                });
            } catch (error) {
                console.error('WebSocket connection failed:', error);
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            // Элементы страниц
            const welcomePage = document.getElementById('welcomePage');
            const registrationPage = document.getElementById('registrationPage');
            const roomPage = document.getElementById('roomPage');
            
            // Кнопки и формы
            const startRegistrationBtn = document.getElementById('startRegistration');
            const registrationForm = document.getElementById('registrationForm');
            const birthDateInput = document.getElementById('birth_date');
            const ageValidation = document.getElementById('ageValidation');
            const emailInput = document.getElementById('email');
            const emailCheckmark = document.querySelector('.email-checkmark');
            const birthDateCheckmark = document.querySelector('.birthdate-checkmark');
            const nicknameInput = document.getElementById('nickname');
            const nicknameCheckmark = document.querySelector('.nickname-checkmark');
            const nicknameHelp = document.querySelector('.nickname-help');
            
            // Новые элементы
            const romanticSection = document.getElementById('romanticSection');
            const romanticInterest = document.getElementById('romanticInterest');
            const datingSection = document.getElementById('datingSection');
            const shareLocationBtn = document.getElementById('shareLocation');
            const locationStatus = document.getElementById('locationStatus');
            const agreementText = document.getElementById('agreementText');
            
            // Элементы подсказки
            const nicknameTooltip = document.getElementById('nicknameTooltip');
            const closeTooltip = document.getElementById('closeTooltip');

            // Обработчик клика по картинке комнаты
            roomElements.roomImage.addEventListener('click', toggleQueue);

            // Инициализация приложения
            async function initializeApp() {
                const userId = await getUserId();
                
                if (userId) {
                    // Проверяем, существует ли пользователь в БД
                    const userExists = await checkUserExists(userId);
                    
                    if (userExists) {
                        // Пользователь существует - переходим в комнату ожидания
                        showPage(roomPage);
                        initRoom();
                    } else {
                        // Пользователь не существует - показываем welcome страницу
                        showPage(welcomePage);
                    }
                } else {
                    // user_id не найден - показываем welcome страницу
                    showPage(welcomePage);
                    startRegistrationBtn.disabled = true;
                    startRegistrationBtn.textContent = 'Откройте через Telegram';
                }
            }

            // Показать подсказку для никнейма
            nicknameHelp.addEventListener('click', function() {
                nicknameTooltip.classList.remove('hidden');
            });

            // Закрыть подсказку
            closeTooltip.addEventListener('click', function() {
                nicknameTooltip.classList.add('hidden');
            });

            // Закрыть подсказку при клике вне ее области
            nicknameTooltip.addEventListener('click', function(e) {
                if (e.target === nicknameTooltip) {
                    nicknameTooltip.classList.add('hidden');
                }
            });

            // Валидация никнейма
            nicknameInput.addEventListener('input', function() {
                validateNickname();
            });

            function validateNickname() {
                const nickname = nicknameInput.value.trim();
                
                // Проверяем длину
                if (nickname.length < 6 || nickname.length > 15) {
                    nicknameCheckmark.classList.remove('visible');
                    nicknameHelp.classList.remove('hidden');
                    return false;
                }
                
                // Проверяем на латинские буквы
                const latinRegex = /^[a-zA-Z]+$/;
                if (!latinRegex.test(nickname)) {
                    nicknameCheckmark.classList.remove('visible');
                    nicknameHelp.classList.remove('hidden');
                    return false;
                }
                
                // Никнейм валиден - показываем галочку, скрываем знак вопроса
                nicknameCheckmark.classList.add('visible');
                nicknameHelp.classList.add('hidden');
                return true;
            }

            // Валидация даты рождения
            birthDateInput.addEventListener('input', function() {
                validateBirthDate();
            });

            function validateBirthDate() {
                const birthDateValue = birthDateInput.value.trim();
                
                // Проверяем формат даты ДД-ММ-ГГГГ
                const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
                if (!dateRegex.test(birthDateValue)) {
                    ageValidation.textContent = 'Формат даты: ДД-ММ-ГГГГ';
                    ageValidation.className = 'field-validation error';
                    birthDateCheckmark.classList.remove('visible');
                    romanticSection.classList.add('hidden');
                    agreementText.classList.add('hidden');
                    return false;
                }
                
                // Извлекаем день, месяц и год
                const parts = birthDateValue.split('-');
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                
                // Проверяем валидность даты
                const birthDate = new Date(year, month - 1, day);
                if (birthDate.getDate() !== day || birthDate.getMonth() !== month - 1 || birthDate.getFullYear() !== year) {
                    ageValidation.textContent = 'Неверная дата';
                    ageValidation.className = 'field-validation error';
                    birthDateCheckmark.classList.remove('visible');
                    romanticSection.classList.add('hidden');
                    agreementText.classList.add('hidden');
                    return false;
                }
                
                // Проверяем возраст для романтических отношений (18+)
                const today = new Date();
                const age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }

                // Дата валидна
                ageValidation.textContent = '';
                ageValidation.className = 'field-validation';
                birthDateCheckmark.classList.add('visible');
                
                // Показываем галочку для романтических отношений только если возраст 18+
                if (age >= 18) {
                    romanticSection.classList.remove('hidden');
                } else {
                    romanticSection.classList.add('hidden');
                    datingSection.classList.add('hidden');
                    agreementText.classList.add('hidden');
                    romanticInterest.checked = false;
                }
                
                return true;
            }

            // Обработка галочки романтических отношений
            romanticInterest.addEventListener('change', function() {
                if (this.checked) {
                    datingSection.classList.remove('hidden');
                    agreementText.classList.remove('hidden');
                } else {
                    datingSection.classList.add('hidden');
                    agreementText.classList.add('hidden');
                    locationStatus.textContent = '';
                }
            });

            // Валидация email
            emailInput.addEventListener('input', function() {
                validateEmail();
            });

            function validateEmail() {
                const email = emailInput.value;
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                
                if (!email) {
                    emailCheckmark.classList.remove('visible');
                    return false;
                }
                
                if (!emailRegex.test(email)) {
                    emailCheckmark.classList.remove('visible');
                    return false;
                } else {
                    emailCheckmark.classList.add('visible');
                    return true;
                }
            }

            // Переход к регистрации
            startRegistrationBtn.addEventListener('click', function() {
                showPage(registrationPage);
            });

            // Получение геолокации
            shareLocationBtn.addEventListener('click', function() {
                if (!navigator.geolocation) {
                    locationStatus.textContent = 'Геолокация не поддерживается вашим браузером';
                    locationStatus.className = 'field-validation error';
                    return;
                }

                locationStatus.textContent = 'Определение местоположения...';
                locationStatus.className = 'field-validation';
                
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        const locationData = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        };
                        shareLocationBtn.dataset.location = JSON.stringify(locationData);
                        locationStatus.textContent = 'Местоположение определено!';
                        locationStatus.className = 'field-validation';
                    },
                    function(error) {
                        let errorMessage = 'Ошибка получения местоположения';
                        switch(error.code) {
                            case error.PERMISSION_DENIED:
                                errorMessage = 'Доступ к геолокации запрещен';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMessage = 'Информация о местоположении недоступна';
                                break;
                            case error.TIMEOUT:
                                errorMessage = 'Время запроса местоположения истекло';
                                break;
                        }
                        locationStatus.textContent = errorMessage;
                        locationStatus.className = 'field-validation error';
                    }
                );
            });

            // Отправка формы регистрации
            registrationForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                // Получаем user_id
                const userId = await getUserId();
                if (!userId) {
                    alert('Не удалось определить ID пользователя. Пожалуйста, откройте приложение через Telegram.');
                    return;
                }
                
                // Проверяем валидность никнейма
                if (!validateNickname()) {
                    alert('Пожалуйста, укажите корректный никнейм (только латинские буквы, 6-15 символов)');
                    return;
                }
                
                // Проверяем валидность даты рождения
                if (!validateBirthDate()) {
                    alert('Пожалуйста, укажите корректную дату рождения в формате ДД-ММ-ГГГГ');
                    return;
                }

                // Проверяем валидность email
                if (!validateEmail()) {
                    alert('Пожалуйста, укажите корректный email адрес');
                    return;
                }

                // Получаем выбранный пол
                const genderInput = document.querySelector('input[name="gender"]:checked');
                if (!genderInput) {
                    alert('Пожалуйста, выберите пол');
                    return;
                }

                const formData = {
                    user_id: parseInt(userId),
                    nickname: document.getElementById('nickname').value,
                    email: document.getElementById('email').value,
                    birthday: document.getElementById('birth_date').value,
                    gender: genderInput.value,
                    about: document.getElementById('about').value,
                    dating: romanticInterest.checked,
                    location: shareLocationBtn.dataset.location ? 
                        JSON.parse(shareLocationBtn.dataset.location) : null
                };

                // Если пользователь заинтересован в романтических отношениях,
                // считаем, что он согласен с условиями (так как текст согласия отображается)
                if (romanticInterest.checked) {
                    formData.dating_agreement = true;
                }

                try {
                    const response = await fetch(`${API_BASE_URL}/api/register`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(formData)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        showPage(roomPage);
                        initRoom();
                    } else {
                        const error = await response.json();
                        alert(`Ошибка регистрации: ${error.detail || 'Неизвестная ошибка'}`);
                    }
                } catch (error) {
                    alert('Ошибка соединения с сервером');
                    console.error('Registration error:', error);
                }
            });

            function showPage(page) {
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                page.classList.add('active');
            }
            
            // Инициализация - запускаем валидацию никнейма при загрузке
            validateNickname();
            
            // Инициализируем приложение
            initializeApp();
        });