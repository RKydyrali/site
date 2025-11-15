// ==============================================
// 1. СИСТЕМА ПАМЯТИ ИГРОКА И СОСТОЯНИЯ ЗАДАНИЙ
// ==============================================

// Ждем, пока весь HTML-контент загрузится
document.addEventListener('DOMContentLoaded', () => {

    const PlayerState = {
        level: "A1",
        trophies: 5000,
        coins: 1240, 
        mistakeMemory: [
            "Present Simple Tense conjugation",
            "Use of 'a' and 'an' articles",
            "'am', 'is', 'are'"
        ],
        topics: [
            "Daily routine",
            "Family and friends",
            "Describing hobbies",
            "Ordering food"
        ]
    };

    let currentTasks = [];
    let currentTaskIndex = 0;
    let userAnswers = []; // Массив для хранения ответов
    let totalCorrectAnswers = 0; // Общий счетчик правильных ответов
    const COINS_PER_CORRECT_ANSWER = 5;

    // ==============================================
    // 2. УПРАВЛЕНИЕ ЭЛЕМЕНТАМИ И UI
    // ==============================================
    const aiTaskModal = document.getElementById('aiTaskModal');
    const closeAiTaskModalBtn = document.getElementById('closeAiTaskModal');
    const aiTaskLoader = document.getElementById('aiTaskLoader');
    const taskBox = document.getElementById('task-box'); 
    const aiTaskQuestionArea = document.getElementById('ai-task-question-area');
    const aiTaskOptionsArea = document.getElementById('ai-task-options-area');

    const nextTaskBtn = document.getElementById('nextTaskBtn');
    const prevTaskBtn = document.getElementById('prevTaskBtn');
    const submitAnswerBtn = document.getElementById('submitAnswerBtn');
    const showResultsBtn = document.getElementById('showResultsBtn'); 
    const skipVocabBtn = document.getElementById('skipVocabBtn');
    const forceEndTestBtn = document.getElementById('forceEndTestBtn'); // КНОПКА "ЗАКОНЧИТЬ"

    const coinsDisplay = document.querySelector('.currency-item:nth-child(2) .currency-value'); 
    const coinAnimation = document.getElementById('coinAnimation');
    const aiLevelInfo = document.querySelector('.ai-level-info');
    const aiTaskModalTitle = document.getElementById('aiTaskModalTitle');

    let currentTaskType = '';

    // Получаем все интерактивные кнопки заданий
    const taskButtons = document.querySelectorAll('.task-item'); 

    // Установка слушателей событий
    taskButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            currentTaskType = button.getAttribute('data-task-type') || 'General';
            openAiTaskModal();
        });
    });

    closeAiTaskModalBtn.addEventListener('click', closeAiTaskModal);
    prevTaskBtn.addEventListener('click', () => navigateTasks(-1));
    nextTaskBtn.addEventListener('click', () => navigateTasks(1));
    skipVocabBtn.addEventListener('click', () => navigateTasks(1)); // "Знаю" = Пропустить
    submitAnswerBtn.addEventListener('click', checkCurrentAnswer);
    forceEndTestBtn.addEventListener('click', showFinalResults); // "Закончить"


    // Обновляем дисплей монет при запуске
    if (coinsDisplay) coinsDisplay.textContent = PlayerState.coins;
    if (aiLevelInfo) aiLevelInfo.textContent = `Текущий уровень: ${PlayerState.level}`;


    function openAiTaskModal() {
        aiTaskModal.style.display = 'flex';
        resetTaskState();
        generateTasks(currentTaskType); // Генерируем первую партию заданий
    }

    function closeAiTaskModal() {
        aiTaskModal.style.display = 'none';
        resetTaskState();
    }

    function resetTaskState() {
        currentTasks = [];
        currentTaskIndex = 0;
        userAnswers = [];
        totalCorrectAnswers = 0; // Сбрасываем счетчик
        aiTaskQuestionArea.innerHTML = '';
        aiTaskOptionsArea.innerHTML = '';
        taskBox.classList.add('hidden');
        aiTaskLoader.style.display = 'block';
        updateNavigationButtons();
    }

    // ==============================================
    // 3. ЛОГИКА НАВИГАЦИИ, ПРОВЕРКИ И МОНЕТ
    // ==============================================

    function navigateTasks(direction) {
        
        // БЕСКОНЕЧНЫЙ РЕЖИМ:
        // Если мы на последнем вопросе и нажимаем "Далее"
        if (direction === 1 && currentTaskIndex === currentTasks.length - 1) {
            // Генерируем новые задания (новую "партию")
            generateTasks(currentTaskType);
            currentTaskIndex = 0; // Сбрасываем индекс на 0
            return;
        }
        
        const newIndex = currentTaskIndex + direction;

        if (newIndex >= 0 && newIndex < currentTasks.length) {
            currentTaskIndex = newIndex;
            displayTask(currentTaskIndex); // Отображаем следующее задание в той же "коробке"
        } else if (newIndex >= currentTasks.length) {
            // Если задания закончились, показываем результаты
            showFinalResults();
        }
    }

    function saveCurrentAnswer(answer) {
        const task = currentTasks[currentTaskIndex];
        let currentAnswer = answer;
        
        if (!currentAnswer) {
            const inputField = aiTaskOptionsArea.querySelector('.answer-input');
            if (inputField) currentAnswer = inputField.value.trim();
            
            const selectedBtn = aiTaskOptionsArea.querySelector('.option-btn.selected');
            if (selectedBtn) currentAnswer = selectedBtn.textContent;
        }
        
        userAnswers[currentTaskIndex] = { 
            ...userAnswers[currentTaskIndex],
            answer: currentAnswer,
        };
    }

    function checkCurrentAnswer() {
        const currentSlide = aiTaskOptionsArea;
        const task = currentTasks[currentTaskIndex];
        
        let userAnswer = null;
        if (task.task_type === 'Multiple Choice' || currentTaskType === 'Vocabulary') {
            const selectedBtn = currentSlide.querySelector('.option-btn.selected');
            if (selectedBtn) userAnswer = selectedBtn.textContent;
        } else {
            const inputField = currentSlide.querySelector('.answer-input');
            if (inputField) userAnswer = inputField.value.trim();
        }
        
        if (!userAnswer) {
            alert("Выберите или введите ответ!");
            return;
        }

        saveCurrentAnswer(userAnswer);
        const isCorrect = isAnswerCorrect(task.correct_answer, userAnswer);
        
        const options = currentSlide.querySelectorAll('.option-btn');
        const input = currentSlide.querySelector('.answer-input');
        
        // Логика для Vocabulary (повторные попытки, мгновенное начисление)
        if (currentTaskType === 'Vocabulary') {
            if (isCorrect && !userAnswers[currentTaskIndex]?.isCorrect) {
                userAnswers[currentTaskIndex].isCorrect = true;
                totalCorrectAnswers++; // Увеличиваем общий счетчик
                awardCoins();
                
                options.forEach(btn => {
                    btn.disabled = true; 
                    if (isAnswerCorrect(task.correct_answer, btn.textContent)) {
                        btn.classList.add('correct');
                    }
                });
                
                // Показываем кнопку "Далее" (которая заменяет "Знаю")
                updateNavigationButtons();

            } else if (!userAnswers[currentTaskIndex]?.isCorrect) {
                 options.forEach(btn => {
                    if (btn.classList.contains('selected')) {
                        btn.classList.add('incorrect');
                    }
                });
                setTimeout(() => {
                    options.forEach(btn => btn.classList.remove('incorrect'));
                }, 500);
            }
            return; 
        }
        
        // Логика для других режимов (одна попытка, блокировка)
        userAnswers[currentTaskIndex].isCorrect = isCorrect;
        
        options.forEach(btn => btn.disabled = true);
        if (input) input.disabled = true;
        submitAnswerBtn.disabled = true;

        if (task.task_type === 'Multiple Choice' || task.task_type === 'Quiz') {
            options.forEach(btn => {
                if (isAnswerCorrect(task.correct_answer, btn.textContent)) {
                    btn.classList.add('correct');
                } else if (btn.classList.contains('selected')) {
                    btn.classList.add('incorrect');
                }
            });
        }

        if (isCorrect) {
            totalCorrectAnswers++; // Увеличиваем общий счетчик
            awardCoins();
        }

        // Показываем кнопку "Далее"
        updateNavigationButtons();
    }

    function awardCoins() {
        PlayerState.coins += COINS_PER_CORRECT_ANSWER;
        if (coinsDisplay) coinsDisplay.textContent = PlayerState.coins;
        
        coinAnimation.classList.remove('hidden');
        coinAnimation.style.opacity = 1;
        coinAnimation.style.transform = 'translateY(0) scale(1)';
        
        coinAnimation.style.animation = 'none';
        coinAnimation.offsetHeight; 
        coinAnimation.style.animation = 'coinFly 1s ease-out forwards';
        
        setTimeout(() => {
            coinAnimation.classList.add('hidden');
        }, 1000);
    }

    function isAnswerCorrect(correct, user) {
        if (!user) return false;
        const cleanCorrect = String(correct).toLowerCase().trim().replace(/[.?,!]/g, '');
        const cleanUser = String(user).toLowerCase().trim().replace(/[.?,!]/g, '');
        const possibleCorrect = cleanCorrect.split(/[,/]/).map(s => s.trim());
        
        return possibleCorrect.includes(cleanUser);
    }

    function updateNavigationButtons() {
        const isLastTask = currentTaskIndex === currentTasks.length - 1;
        const taskAnswered = userAnswers[currentTaskIndex] && 
                             (currentTaskType === 'Vocabulary' ? userAnswers[currentTaskIndex].isCorrect : userAnswers[currentTaskIndex].answer !== null);

        // Кнопка "Назад"
        prevTaskBtn.classList.toggle('hidden', currentTaskIndex === 0);
        
        // Кнопка "Знаю этот вокабуляр" (свайп)
        skipVocabBtn.classList.toggle('hidden', currentTaskType !== 'Vocabulary' || taskAnswered);
        
        // Кнопка "Проверить" (для Grammar, Mistakes, Quiz)
        submitAnswerBtn.classList.toggle('hidden', currentTaskType === 'Vocabulary' || taskAnswered);
        submitAnswerBtn.disabled = false; 

        // Кнопка "Далее" (появляется после правильного ответа/проверки)
        nextTaskBtn.classList.toggle('hidden', !taskAnswered);
        
        // Кнопка "Завершить" (скрыта)
        showResultsBtn.classList.add('hidden');
        
        // Кнопка "Закончить" (всегда видна)
        forceEndTestBtn.classList.remove('hidden');
    }

    function showFinalResults() {
         alert(`Тест завершен! Правильных ответов: ${totalCorrectAnswers}.`);
         closeAiTaskModal();
    }

    // ==============================================
    // 5. ГЕНЕРАЦИЯ ЗАДАНИЙ (СИМУЛЯЦИЯ AI)
    // ==============================================

    async function generateTasks(taskType) {
        resetTaskState();
        aiTaskLoader.style.display = 'block';
        
        aiTaskModalTitle.textContent = `🧠 AI Error Analysis: ${taskType}`;
        if (aiLevelInfo) aiLevelInfo.textContent = `Текущий уровень: ${PlayerState.level}`;

        // ### ВАЖНО: ЗДЕСЬ НАЧИНАЕТСЯ ЛОГИКА AI ###
        
        // НОВЫЙ API КЛЮЧ
        const API_KEY = "AIzaSyB6IWh-ipTLv-PrE8kk3RZ1L_VeH5u3KCo";
        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`; 

        let specificInstruction = '';
        let mockTaskTypes = []; // Типы для симуляции
        
        if (taskType === 'Vocabulary') {
            specificInstruction = `Focus on simple vocabulary matching/selection tasks...`;
            mockTaskTypes = ['Multiple Choice'];
        } else if (taskType === 'Grammar') {
            specificInstruction = `Focus on grammar rules... Generate tasks of type: Drag-and-Drop (Input) and Correction.`;
            mockTaskTypes = ['Drag-and-Drop (Input)', 'Correction'];
        } else {
            specificInstruction = `Generate a balanced mix of tasks...`;
            mockTaskTypes = ['Multiple Choice', 'Correction', 'Fill in the Blank'];
        } 
        
        // Промпт для реального AI
        const prompt = `
            You are a personalized English language tutor AI.
            Generate 3 short, challenging English language tasks for a player at **${PlayerState.level}** level.
            The overall task focus is: **${taskType}**. ${specificInstruction}
            The tasks must be tailored specifically to the player's recorded **mistakes**: ${PlayerState.mistakeMemory.join(", ")}.
            Each task should be related to one of the following **topics**: ${PlayerState.topics.join(", ")}.
            
            The tasks must use one of these types:
            1. **Multiple Choice** (include 'options' array with 4 items, one is 'correct_answer')
            2. **Correction** (require text input, provide 'correct_answer')
            3. **Fill in the Blank** (require text input, provide 'correct_answer')
            4. **Drag-and-Drop (Input)** (instruction must list words to use, provide 'correct_answer' as full sentence)
            
            Format your response as a JSON array of objects: 
            [
                { "id": 1, "task_type": "...", "instruction": "...", "options": ["...", "...", "...", "..."], "correct_answer": "..."},
                { "id": 2, "task_type": "...", "instruction": "...", "correct_answer": "..."},
                { "id": 3, "task_type": "...", "instruction": "...", "correct_answer": "..."}
            ]
            The response MUST ONLY contain the JSON array.
        `;

        try {
            // --- БЛОК СИМУЛЯЦИИ API (Используется сейчас) ---
            // Он использует getMockTasks() для создания 3х СЛУЧАЙНЫХ заданий из банка
            
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            const mockTasksRaw = getMockTasks(taskType, mockTaskTypes); // Получаем случайные задания
            currentTasks = mockTasksRaw.slice(0, 3).map((task, index) => ({...task, id: index + 1}));
            userAnswers = new Array(currentTasks.length).fill(null);
            // --- КОНЕЦ БЛОКА СИМУЛЯЦИИ ---

            
            /* // --- РЕАЛЬНЫЙ API (ЗАКОММЕНТИРОВАН) ---
            // РАСКОММЕНТИРУЙ ЭТОТ БЛОК И УДАЛИ БЛОК СИМУЛЯЦИИ, КОГДА БУДЕШЬ ГОТОВ
            // Убедись, что запускаешь это с ВЕБ-СЕРВЕРА (например, Live Server), иначе будет ОШИБКА CORS
            
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  "contents": [{
                    "parts": [{"text": prompt}]
                  }]
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            // ВАЖНО: Google AI возвращает JSON внутри JSON.
            // Тебе нужно будет извлечь текст и распарсить его.
            const rawText = data.candidates[0].content.parts[0].text;
            
            // Очистка ответа AI от ```json ... ```
            const cleanJsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const tasks = JSON.parse(cleanJsonText);
            
            currentTasks = tasks.map((task, index) => ({...task, id: index + 1}));
            userAnswers = new Array(currentTasks.length).fill(null);
            // --- КОНЕЦ РЕАЛЬНОГО API ---
            */
            
            aiTaskLoader.style.display = 'none';
            taskBox.classList.remove('hidden');
            displayTask(0); // Отображаем первое задание

        } catch (error) {
            aiTaskLoader.style.display = 'none';
            taskBox.classList.remove('hidden');
            aiTaskQuestionArea.innerHTML = `<p style="color: red;">Ошибка генерации заданий: ${error.message}. Убедись, что ты используешь веб-сервер (ошибка CORS) и твой API ключ (${API_KEY}) активен.</p>`;
            console.error(error);
        }
    }

    // ==============================================
    // 6. БАНК ВОПРОСОВ (Для симуляции AI)
    // ==============================================

    const MOCK_QUESTION_BANK = [
        // Vocabulary (Multiple Choice)
        { 
            task_type: "Multiple Choice", 
            instruction: `(Vocabulary) What is the English word for 'сестра'?`, 
            options: ["brother", "aunt", "sister", "cousin"], 
            correct_answer: "sister"
        },
        { 
            task_type: "Multiple Choice", 
            instruction: `(Vocabulary) What does 'hobby' mean?`, 
            options: ["Работа", "Хобби", "Еда", "Сон"], 
            correct_answer: "Хобби"
        },
        { 
            task_type: "Multiple Choice", 
            instruction: `(Vocabulary) Choose the word for 'завтрак'.`, 
            options: ["Dinner", "Lunch", "Breakfast", "Supper"], 
            correct_answer: "Breakfast"
        },
        { 
            task_type: "Multiple Choice", 
            instruction: `(Vocabulary) What is the English word for 'яблоко'?`, 
            options: ["Apple", "Pear", "Orange", "Banana"], 
            correct_answer: "Apple"
        },
        
        // Grammar (Multiple Choice)
        { 
            task_type: "Multiple Choice", 
            instruction: `(Grammar: Mistake 'to be') Which is correct?`, 
            options: ["I am a student", "I is a student", "I are a student", "I be a student"], 
            correct_answer: "I am a student"
        },
        { 
            task_type: "Multiple Choice", 
            instruction: `(Grammar: Mistake 'a/an') I need ___ umbrella.`, 
            options: ["a", "an", "the", "—"], 
            correct_answer: "an"
        },
        { 
            task_type: "Multiple Choice", 
            instruction: `(Grammar: Mistake 'Present Simple') He ___ to school.`, 
            options: ["go", "goes", "is go", "are go"], 
            correct_answer: "goes"
        },
        
        // Correction (Input)
        { 
            task_type: "Correction", 
            instruction: `(Grammar: Mistake 'to be') Correct the mistake: They is happy.`, 
            correct_answer: "They are happy"
        },
        { 
            task_type: "Correction", 
            instruction: `(Grammar: Mistake 'Present Simple') Correct the mistake: She like cats.`, 
            correct_answer: "She likes cats"
        },
        
        // Fill in the Blank (Input)
        { 
            task_type: "Fill in the Blank", 
            instruction: `(Topic: Daily routine) Complete the sentence: I ___ (get up) at 7 AM.`, 
            correct_answer: "get up"
        },
        { 
            task_type: "Fill in the Blank", 
            instruction: `(Topic: Family) Complete the sentence: My mother ___ (work) in a bank.`, 
            correct_answer: "works"
        },
        
        // Drag-and-Drop (Input)
        {
             task_type: "Drag-and-Drop (Input)",
             instruction: `(Topic: Food) Составьте предложение (введите слова через пробел): is, ordering, He, pizza, a.`,
             correct_answer: "He is ordering a pizza"
        },
        {
             task_type: "Drag-and-Drop (Input)",
             instruction: `(Topic: Hobbies) Составьте предложение (введите слова через пробел): like, I, music, to, listen.`,
             correct_answer: "I like to listen to music"
        }
    ];

    // Функция, которая СЛУЧАЙНО выбирает задания из банка
    function getMockTasks(type) {
        let desiredTypes = [];

        // Определяем типы заданий
        if (type === 'Vocabulary') {
            desiredTypes = ['Multiple Choice']; // Vocabulary всегда Multiple Choice
        } else if (type === 'Grammar') {
            desiredTypes = ['Drag-and-Drop (Input)', 'Correction'];
        } else {
            // Микс для Quiz, Daily Mistakes, Battle Mistakes
            desiredTypes = ['Multiple Choice', 'Correction', 'Fill in the Blank', 'Drag-and-Drop (Input)'];
        }

        // 1. Фильтруем банк по нужным типам
        const filteredTasks = MOCK_QUESTION_BANK.filter(task => {
            if (type === 'Vocabulary') {
                // Специальная фильтрация для вокабуляра
                return task.instruction.includes('(Vocabulary)');
            }
            return desiredTypes.includes(task.task_type);
        });
        
        // 2. Перемешиваем отфильтрованный массив (алгоритм Фишера-Йейтса)
        let shuffled = [...filteredTasks];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // 3. Возвращаем 3 случайных задания
        return shuffled.slice(0, 3);
    }


    // ==============================================
    // 5. ОТОБРАЖЕНИЕ ОДНОГО СТАТИЧНОГО ЗАДАНИЯ
    // ==============================================

    function displayTask(taskIndex) {
        const task = currentTasks[taskIndex];
        
        // 1. Очистка областей
        aiTaskQuestionArea.innerHTML = '';
        aiTaskOptionsArea.innerHTML = '';
        
        // 2. Заполнение вопроса
        aiTaskQuestionArea.innerHTML = `
            <h4>Задание ${currentTaskIndex + 1}: ${task.task_type}</h4>
            <p class="task-instruction">
                <span class="instruction-label">Инструкция:</span>
                ${task.instruction}
            </p>
        `;

        // 3. Заполнение вариантов ответа
        let interactiveHTML = '';
        if (task.task_type === 'Multiple Choice' || task.task_type === 'Vocabulary Question') {
            const optionsHTML = task.options.map(option => 
                `<button class="option-btn">${option}</button>`
            ).join('');
            interactiveHTML = `<div class="options-container">${optionsHTML}</div>`;
        } else {
            let placeholder = 'Введите ваш ответ здесь...';
            if (task.task_type === 'Drag-and-Drop (Input)') {
                placeholder = 'Введите слова в правильном порядке (имитация перетаскивания)';
            }
            interactiveHTML = `
                <textarea class="answer-input" placeholder="${placeholder}"></textarea>
            `;
        }
        aiTaskOptionsArea.innerHTML = interactiveHTML;
        
        // 4. Установка слушателей для кнопок-опций
        if (task.task_type === 'Multiple Choice' || task.task_type === 'Vocabulary Question') {
            aiTaskOptionsArea.querySelectorAll('.option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    aiTaskOptionsArea.querySelectorAll('.option-btn').forEach(ob => ob.classList.remove('selected'));
                    btn.classList.add('selected');
                    
                    if (currentTaskType === 'Vocabulary') {
                        checkCurrentAnswer(); // Мгновенная проверка для Vocabulary
                    } else {
                        saveCurrentAnswer(btn.textContent);
                    }
                });
            });
        }
        
        // 5. Обновление кнопок навигации
        updateNavigationButtons();
    }
    
}); // Конец 'DOMContentLoaded'