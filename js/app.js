(() => {
    'use strict';

    const { questions, datasets } = window.SQL_THEORY;
    const byId = new Map(questions.map((q) => [q.id, q]));
    const STORAGE_KEY = 'sql-theory-trainer-v1';
    const THEME_KEY = 'sql-theory-trainer-theme';
    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

    const $ = (id) => document.getElementById(id);
    const els = {
        startScreen: $('startScreen'),
        quizScreen: $('quizScreen'),
        resultScreen: $('resultScreen'),
        startBtn: $('startBtn'),
        clearBtn: $('clearBtn'),
        shuffleToggle: $('shuffleToggle'),
        startHint: $('startHint'),
        scorePill: $('scorePill'),
        resetBtn: $('resetBtn'),
        themeBtn: $('themeBtn'),
        qTag: $('qTag'),
        qTopic: $('qTopic'),
        qCounter: $('qCounter'),
        progressBar: $('progressBar'),
        progressTrack: $('progressTrack'),
        qPrompt: $('qPrompt'),
        qDataset: $('qDataset'),
        qSql: $('qSql'),
        qOptions: $('qOptions'),
        qFeedback: $('qFeedback'),
        checkBtn: $('checkBtn'),
        qMap: $('qMap'),
        sideProgress: $('sideProgress'),
        ring: $('ring'),
        resultPercent: $('resultPercent'),
        resultScore: $('resultScore'),
        resultTitle: $('resultTitle'),
        resultText: $('resultText'),
        breakdown: $('breakdown'),
        retryWrongBtn: $('retryWrongBtn'),
        restartBtn: $('restartBtn'),
        toStartBtn: $('toStartBtn'),
        review: $('review'),
    };

    const SQL_KEYWORDS = new Set(
        (
            'SELECT FROM WHERE AS CROSS JOIN INNER RIGHT LEFT FULL OUTER ON AND OR NOT NULL IS IN EXISTS ' +
            'LIMIT ORDER BY ASC DESC NULLS FIRST LAST GROUP HAVING DISTINCT COUNT SUM STRING_AGG OVER ' +
            'ROW_NUMBER WITH UNION ALL CASE WHEN THEN ELSE END LIKE INSERT INTO UPDATE DELETE CREATE TABLE ' +
            'INDEX ADD CONSTRAINT ALTER DROP PRIMARY KEY FOREIGN REFERENCES CHECK UNIQUE DEFAULT VALUES SET ' +
            'COMMIT ROLLBACK BEGIN TRANSACTION VARCHAR INTEGER'
        ).split(' ')
    );
    const SQL_TOKEN = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|\b\d+\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    let selectedMode = 'all';
    let selectedShuffle = false;
    let state = loadState();

    selectedMode = state.mode;
    selectedShuffle = state.shuffle;

    function blankState() {
        return { mode: 'all', shuffle: false, order: [], index: 0, answers: {}, finished: false };
    }

    function loadState() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!data || typeof data !== 'object') return blankState();

            const order = Array.isArray(data.order) ? data.order.filter((id) => byId.has(id)) : [];
            const answers = {};
            if (data.answers && typeof data.answers === 'object') {
                for (const [rawId, answer] of Object.entries(data.answers)) {
                    const id = Number(rawId);
                    const question = byId.get(id);
                    if (!question || !answer || !Array.isArray(answer.selected)) continue;
                    answers[id] = {
                        selected: answer.selected.filter(
                            (i) => Number.isInteger(i) && i >= 0 && i < question.options.length
                        ),
                        checked: Boolean(answer.checked),
                        correct: Boolean(answer.correct),
                    };
                }
            }

            return {
                mode: ['all', 'theory', 'practice'].includes(data.mode) ? data.mode : 'all',
                shuffle: Boolean(data.shuffle),
                order,
                index: Math.min(Math.max(0, Number(data.index) || 0), Math.max(0, order.length - 1)),
                answers,
                finished: Boolean(data.finished),
            };
        } catch (_) {
            return blankState();
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_) {
            /* приватный режим браузера */
        }
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function escapeHtml(value) {
        return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
    }

    function highlightSql(sql) {
        let out = '';
        let last = 0;
        let match;
        SQL_TOKEN.lastIndex = 0;
        while ((match = SQL_TOKEN.exec(sql))) {
            out += escapeHtml(sql.slice(last, match.index));
            const token = match[0];
            let cls = '';
            if (token.startsWith('--') || token.startsWith('/*')) cls = 'tok-c';
            else if (token.startsWith("'")) cls = 'tok-s';
            else if (/^\d+$/.test(token)) cls = 'tok-n';
            else if (SQL_KEYWORDS.has(token.toUpperCase())) cls = 'tok-k';
            out += cls ? `<span class="${cls}">${escapeHtml(token)}</span>` : escapeHtml(token);
            last = match.index + token.length;
        }
        return out + escapeHtml(sql.slice(last));
    }

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        if (!ok) throw new Error('copy failed');
    }

    function sqlBlock(sql) {
        const block = el('div', 'sql-block');
        const head = el('div', 'sql-head');
        head.append(el('span', '', 'SQL'));
        const copy = el('button', 'copy-btn', 'Копировать');
        copy.type = 'button';
        copy.addEventListener('click', async () => {
            try {
                await copyText(sql);
                copy.textContent = 'Скопировано';
            } catch (_) {
                copy.textContent = 'Не вышло';
            }
            setTimeout(() => {
                copy.textContent = 'Копировать';
            }, 1400);
        });
        head.append(copy);
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.innerHTML = highlightSql(sql);
        pre.append(code);
        block.append(head, pre);
        return block;
    }

    function datasetNode(key) {
        const fragment = document.createDocumentFragment();
        for (const table of datasets[key] || []) {
            const card = el('div', 'data-card');
            card.append(el('div', 'data-title', table.name));
            const scroll = el('div', 'table-scroll');
            const tableNode = document.createElement('table');

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            for (const column of table.columns) headerRow.append(el('th', '', column));
            thead.append(headerRow);
            tableNode.append(thead);

            const tbody = document.createElement('tbody');
            for (const row of table.rows) {
                const tr = document.createElement('tr');
                for (const value of row) {
                    const td = document.createElement('td');
                    if (value === null) {
                        td.textContent = 'NULL';
                        td.className = 'is-null';
                    } else {
                        td.textContent = String(value);
                    }
                    tr.append(td);
                }
                tbody.append(tr);
            }
            tableNode.append(tbody);
            scroll.append(tableNode);
            card.append(scroll);
            fragment.append(card);
        }
        return fragment;
    }

    function currentQuestion() {
        return byId.get(state.order[state.index]);
    }

    function counts() {
        let answered = 0;
        let correct = 0;
        for (const id of state.order) {
            const answer = state.answers[id];
            if (answer && answer.checked) {
                answered += 1;
                if (answer.correct) correct += 1;
            }
        }
        return { answered, correct, wrong: answered - correct, total: state.order.length };
    }

    function poolCount(mode) {
        return mode === 'all' ? questions.length : questions.filter((q) => q.kind === mode).length;
    }

    function sameSettings() {
        return state.mode === selectedMode && state.shuffle === selectedShuffle;
    }

    function updateScorePill() {
        const { correct, wrong } = counts();
        els.scorePill.replaceChildren(
            el('span', '', '✓ '),
            el('b', '', String(correct)),
            el('span', '', ' · ✗ '),
            el('i', '', String(wrong))
        );
    }

    function showScreen(name) {
        els.startScreen.hidden = name !== 'start';
        els.quizScreen.hidden = name !== 'quiz';
        els.resultScreen.hidden = name !== 'result';
        const quizTools = name !== 'start';
        els.scorePill.hidden = !quizTools;
        els.resetBtn.hidden = !quizTools || state.order.length === 0;
        document.body.dataset.screen = name;
        window.scrollTo(0, 0);
    }

    function renderStart() {
        for (const button of document.querySelectorAll('.mode-btn')) {
            button.classList.toggle('active', button.dataset.mode === selectedMode);
        }
        els.shuffleToggle.checked = selectedShuffle;

        const { answered, correct, total } = counts();
        const resumable = state.order.length > 0 && !state.finished && sameSettings();
        const finishedHere = state.finished && sameSettings();

        if (resumable) {
            els.startBtn.textContent = `Продолжить · ${answered} из ${state.order.length}`;
            els.startHint.textContent = `Отвечено ${answered} из ${state.order.length}. Прогресс сохранён в браузере.`;
        } else if (finishedHere) {
            els.startBtn.textContent = 'Посмотреть результат';
            els.startHint.textContent = `Результат: ${correct} из ${total}.`;
        } else {
            els.startBtn.textContent = 'Начать тест';
            els.startHint.textContent = `${poolCount(selectedMode)} вопросов · ответ проверяется сразу, с разбором.`;
        }

        els.clearBtn.hidden = state.order.length === 0;
    }

    function startNew(mode = selectedMode, shuffle = selectedShuffle) {
        selectedMode = mode;
        selectedShuffle = shuffle;
        const pool = questions.filter((q) => mode === 'all' || q.kind === mode);
        const order = pool.map((q) => q.id);
        if (shuffle) {
            for (let i = order.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
        }
        state = { mode, shuffle, order, index: 0, answers: {}, finished: false };
        saveState();
        showScreen('quiz');
        renderQuiz();
    }

    function renderChrome() {
        const { answered, total } = counts();
        els.qCounter.textContent = `Вопрос ${state.index + 1} из ${total}`;
        const percent = total ? (answered / total) * 100 : 0;
        els.progressBar.style.width = `${percent}%`;
        els.progressTrack.setAttribute('aria-valuenow', String(Math.round(percent)));
        els.sideProgress.textContent = `${answered} / ${total}`;
        updateScorePill();
    }

    function renderMap() {
        els.qMap.replaceChildren();
        state.order.forEach((id, index) => {
            const question = byId.get(id);
            const answer = state.answers[id];
            const button = el('button', '', String(index + 1));
            button.type = 'button';
            if (index === state.index) button.classList.add('is-current');
            if (answer && answer.checked) button.classList.add(answer.correct ? 'is-correct' : 'is-wrong');
            button.title = question.prompt;
            button.setAttribute(
                'aria-label',
                `Вопрос ${index + 1}${answer && answer.checked ? (answer.correct ? ', верно' : ', ошибка') : ''}`
            );
            button.addEventListener('click', () => goTo(index));
            els.qMap.append(button);
        });
    }

    function answerLine(label, indexes, question) {
        const line = el('p', 'answer-line', `${label} `);
        line.append(el('b', '', indexes.map((i) => `${LETTERS[i]} · ${question.options[i]}`).join(' / ')));
        return line;
    }

    function renderFeedback(question, answer) {
        if (!answer || !answer.checked) {
            els.qFeedback.hidden = true;
            els.qFeedback.replaceChildren();
            return;
        }

        els.qFeedback.hidden = false;
        els.qFeedback.className = `feedback ${answer.correct ? 'good' : 'bad'}`;
        const fragment = document.createDocumentFragment();
        fragment.append(el('div', 'feedback-head', answer.correct ? '✓ Верно' : '✗ Неверно'));

        if (!answer.correct) fragment.append(answerLine('Твой выбор:', answer.selected, question));

        const label = question.correct.length > 1 ? 'Засчитывается:' : 'Правильный ответ:';
        fragment.append(answerLine(label, question.correct, question));
        fragment.append(el('div', 'expl-label', 'Разбор'));
        fragment.append(el('p', 'expl', question.explanation));

        els.qFeedback.replaceChildren(fragment);
    }

    function updateActionButton() {
        const question = currentQuestion();
        if (!question) return;
        const answer = state.answers[question.id];
        const checked = Boolean(answer && answer.checked);
        const allAnswered = counts().answered === state.order.length;
        if (checked) {
            const last = state.index === state.order.length - 1;
            els.checkBtn.textContent = last && allAnswered ? 'Результат' : 'Далее';
            els.checkBtn.disabled = false;
        } else {
            els.checkBtn.textContent = 'Ответить';
            els.checkBtn.disabled = !(answer && answer.selected.length);
        }
    }

    function renderOptions() {
        const question = currentQuestion();
        if (!question) return;
        const answer = state.answers[question.id];
        const checked = Boolean(answer && answer.checked);
        const selected = answer ? answer.selected : [];

        els.qOptions.replaceChildren();
        question.options.forEach((text, index) => {
            const button = el('button', 'option');
            button.type = 'button';
            button.append(el('span', 'letter', LETTERS[index]), el('span', '', text));

            if (!checked && selected.includes(index)) button.classList.add('is-selected');
            if (checked) {
                button.disabled = true;
                if (question.correct.includes(index)) button.classList.add('is-correct');
                else if (selected.includes(index)) button.classList.add('is-wrong');
                else button.classList.add('is-dim');
            }

            button.addEventListener('click', () => selectOption(index));
            els.qOptions.append(button);
        });

        renderFeedback(question, answer);
        updateActionButton();
    }

    function renderQuiz() {
        const question = currentQuestion();
        if (!question) {
            renderStart();
            showScreen('start');
            return;
        }

        els.qTag.textContent = question.tag;
        els.qTopic.textContent = question.topic;
        els.qPrompt.textContent = question.prompt;

        els.qDataset.replaceChildren();
        if (question.dataset) els.qDataset.append(datasetNode(question.dataset));

        els.qSql.replaceChildren();
        if (question.sql) els.qSql.append(sqlBlock(question.sql));

        renderOptions();
        renderMap();
        renderChrome();
    }

    function selectOption(index) {
        const question = currentQuestion();
        if (!question) return;
        const answer = state.answers[question.id];
        if (answer && answer.checked) return;

        state.answers[question.id] = { selected: [index], checked: false, correct: false };
        saveState();
        renderOptions();
    }

    function checkAnswer() {
        const question = currentQuestion();
        if (!question) return;
        const answer = state.answers[question.id];
        if (!answer || answer.checked || !answer.selected.length) return;

        const correct = answer.selected.every((index) => question.correct.includes(index));
        state.answers[question.id] = { selected: answer.selected, checked: true, correct };
        saveState();
        renderOptions();
        renderMap();
        renderChrome();
        els.checkBtn.focus({ preventScroll: true });
    }

    function goTo(index) {
        if (index < 0 || index >= state.order.length) return;
        state.index = index;
        saveState();
        renderQuiz();
        window.scrollTo(0, 0);
    }

    function goNext() {
        if (state.index < state.order.length - 1) {
            state.index += 1;
            saveState();
            renderQuiz();
            window.scrollTo(0, 0);
            return;
        }

        const unanswered = state.order.findIndex((id) => {
            const answer = state.answers[id];
            return !answer || !answer.checked;
        });
        if (unanswered !== -1) {
            state.index = unanswered;
            saveState();
            renderQuiz();
            window.scrollTo(0, 0);
            return;
        }

        finishQuiz();
    }

    function handleAction() {
        const question = currentQuestion();
        if (!question) return;
        const answer = state.answers[question.id];
        if (answer && answer.checked) goNext();
        else checkAnswer();
    }

    function kindStats(kind) {
        const ids = state.order.filter((id) => byId.get(id).kind === kind);
        const correct = ids.filter((id) => {
            const answer = state.answers[id];
            return answer && answer.checked && answer.correct;
        }).length;
        return { total: ids.length, correct };
    }

    function finishQuiz() {
        state.finished = true;
        saveState();
        showScreen('result');
        renderResults();
    }

    function renderResults() {
        const { answered, correct, wrong, total } = counts();
        const unanswered = total - answered;
        const percent = total ? Math.round((correct / total) * 100) : 0;

        els.ring.style.setProperty('--p', String(percent));
        els.resultPercent.textContent = `${percent}%`;
        els.resultScore.textContent = `${correct} из ${total}`;
        updateScorePill();

        let title = 'Стоит повторить.';
        let text = 'Начни с разбора ошибок: там весь потенциал роста.';
        if (percent === 100) {
            title = 'Идеально.';
            text = 'Все вопросы закрыты. Можно выдыхать и идти на экзамен.';
        } else if (percent >= 85) {
            title = 'Отличный результат.';
            text = 'Основа уверенная. Осталось закрыть пару мест.';
        } else if (percent >= 65) {
            title = 'Хорошо.';
            text = 'Большая часть уже в кармане, но ошибки стоит разобрать.';
        } else if (percent >= 40) {
            title = 'Есть что подтянуть.';
            text = 'Разбери ошибки и пройди ещё раз — станет заметно легче.';
        }
        if (unanswered > 0) text += ` Без ответа: ${unanswered}.`;
        els.resultTitle.textContent = title;
        els.resultText.textContent = text;

        const theory = kindStats('theory');
        const practice = kindStats('practice');
        els.breakdown.replaceChildren();
        if (theory.total) {
            const pill = el('span', 'pill', 'Теория ');
            pill.append(el('b', '', `${theory.correct} / ${theory.total}`));
            els.breakdown.append(pill);
        }
        if (practice.total) {
            const pill = el('span', 'pill', 'Практика ');
            pill.append(el('b', '', `${practice.correct} / ${practice.total}`));
            els.breakdown.append(pill);
        }
        if (wrong) {
            const pill = el('span', 'pill', 'Ошибки ');
            pill.append(el('b', '', String(wrong)));
            els.breakdown.append(pill);
        }
        if (unanswered) {
            const pill = el('span', 'pill', 'Без ответа ');
            pill.append(el('b', '', String(unanswered)));
            els.breakdown.append(pill);
        }

        const wrongIds = state.order.filter((id) => {
            const answer = state.answers[id];
            return !answer || !answer.checked || !answer.correct;
        });
        els.retryWrongBtn.hidden = wrongIds.length === 0;
        els.retryWrongBtn.textContent = `Разобрать ошибки · ${wrongIds.length}`;
        renderReview(wrongIds);
    }

    function renderReview(wrongIds) {
        els.review.replaceChildren();
        if (!wrongIds.length) {
            els.review.append(el('h2', 'review-title', 'Ошибок нет'));
            els.review.append(el('p', 'muted', 'Все вопросы отвечены верно. Можно пройти тест заново или вернуться к началу.'));
            return;
        }

        els.review.append(el('h2', 'review-title', `Разбор ошибок · ${wrongIds.length}`));
        for (const id of wrongIds) {
            const question = byId.get(id);
            const position = state.order.indexOf(id) + 1;
            const answer = state.answers[id];

            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.append(el('span', 'num', String(position).padStart(2, '0')), el('span', '', question.prompt));
            details.append(summary);

            const body = el('div', 'review-body');
            if (!answer || !answer.checked) {
                body.append(el('p', '', 'Ответа нет.'));
            } else if (!answer.correct) {
                body.append(answerLine('Твой выбор:', answer.selected, question));
            }
            body.append(answerLine('Правильный ответ:', question.correct, question));
            if (question.dataset) body.append(datasetNode(question.dataset));
            if (question.sql) body.append(sqlBlock(question.sql));

            const explanation = el('p');
            explanation.append(el('b', '', 'Разбор: '), document.createTextNode(question.explanation));
            body.append(explanation);

            details.append(body);
            els.review.append(details);
        }
    }

    function startRetry(ids) {
        if (!ids.length) return;
        state = {
            mode: state.mode,
            shuffle: false,
            order: ids.slice(),
            index: 0,
            answers: {},
            finished: false,
        };
        saveState();
        showScreen('quiz');
        renderQuiz();
    }

    function resetAll() {
        if (!window.confirm('Сбросить весь прогресс?')) return;
        state = blankState();
        selectedMode = 'all';
        selectedShuffle = false;
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (_) {
            /* ignore */
        }
        showScreen('start');
        renderStart();
    }

    function applyTheme(theme, persist = true) {
        document.documentElement.dataset.theme = theme;
        if (persist) {
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch (_) {
                /* ignore */
            }
        }
        const dark = theme === 'dark';
        els.themeBtn.title = dark ? 'Светлая тема' : 'Тёмная тема';
        els.themeBtn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    }

    function initialTheme() {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
        } catch (_) {
            /* ignore */
        }
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    els.startBtn.addEventListener('click', () => {
        if (state.order.length > 0 && !state.finished && sameSettings()) {
            showScreen('quiz');
            renderQuiz();
            return;
        }
        if (state.finished && sameSettings()) {
            showScreen('result');
            renderResults();
            return;
        }
        if (state.order.length > 0 && !state.finished) {
            const leave = window.confirm('Начать новый тест? Прогресс текущего режима сбросится.');
            if (!leave) return;
        }
        startNew();
    });

    els.clearBtn.addEventListener('click', resetAll);
    els.resetBtn.addEventListener('click', resetAll);

    for (const button of document.querySelectorAll('.mode-btn')) {
        button.addEventListener('click', () => {
            selectedMode = button.dataset.mode;
            renderStart();
        });
    }

    els.shuffleToggle.addEventListener('change', () => {
        selectedShuffle = els.shuffleToggle.checked;
        renderStart();
    });

    els.checkBtn.addEventListener('click', handleAction);

    els.retryWrongBtn.addEventListener('click', () => {
        const wrongIds = state.order.filter((id) => {
            const answer = state.answers[id];
            return !answer || !answer.checked || !answer.correct;
        });
        startRetry(wrongIds);
    });

    els.restartBtn.addEventListener('click', () => startNew(state.mode, state.shuffle));
    els.toStartBtn.addEventListener('click', () => {
        selectedMode = state.mode;
        selectedShuffle = state.shuffle;
        showScreen('start');
        renderStart();
    });

    $('homeLink').addEventListener('click', (event) => {
        event.preventDefault();
        selectedMode = state.mode;
        selectedShuffle = state.shuffle;
        showScreen('start');
        renderStart();
    });

    els.themeBtn.addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    document.addEventListener('keydown', (event) => {
        if (els.quizScreen.hidden) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const tag = (event.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        const question = currentQuestion();
        if (!question) return;
        const answer = state.answers[question.id];

        if (!answer || !answer.checked) {
            const index = Number(event.key) - 1;
            if (/^[1-9]$/.test(event.key) && index < question.options.length) {
                event.preventDefault();
                selectOption(index);
                return;
            }
        }

        if (event.key === 'Enter') {
            if (event.target.closest && event.target.closest('button')) return;
            event.preventDefault();
            handleAction();
        }
    });

    applyTheme(initialTheme(), false);
    showScreen('start');
    renderStart();
})();
