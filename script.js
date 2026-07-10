/* script.js */

/**
 * ---------------------------------------------------------
 * NGÂN HÀNG CÂU HỎI (QUESTION BANK)
 * Giáo viên có thể thay đổi câu hỏi tại đây.
 * Định dạng: { q: "Câu hỏi", options: ["A", "B", "C", "D"], correct: chỉ_số_đáp_án_đúng_từ_0_đến_3 }
 * ---------------------------------------------------------
 */
const questions = [
    { q: "What is it?", options: ["bed", "desk", "door"], correct: 0, image: 'assets/bed.png' },
    { q: "Which word is correct?", options: ["windown", "windew", "window"], correct: 2 },
    { q: "There ______ a bed in the room.", options: ["is", "are"], correct: 0 },
    { q: "There ______ four windows in the room.", options: ["is", "are"], correct: 1 },
    { q: "There ______ one door in my room.", options: ["are", "is"], correct: 1 },
    { q: "There ______ three desks in the house.", options: ["is", "are"], correct: 1 },
    { q: "Which sentence is correct?", options: ["There are a bed in the room.", "There is a bed in the room.", "There are two bed in the room."], correct: 1 },
    { q: "Which sentence is correct?", options: ["There is three doors in the room.", "There are one door in the room.", "There are three doors in the room."], correct: 2 },
    { q: "Look and choose:", options: ["There is one window.", "There are two windows.", "There are three windows."], correct: 1, image: 'assets/room_2_windows.png' },
    { q: "There are two beds in the room.", options: ["True", "False"], correct: 1, image: 'assets/room_1_bed_2_doors.jpeg' },
    { q: "There is a desk in the room.", options: ["True", "False"], correct: 0, image: 'assets/room_1_desk.jpeg' },
    { q: "Look and choose the correct sentence", options: ["There is one window and there are two doors.", "There are one window and there is two doors.", "There are two windows and there is one door."], correct: 0, image: 'assets/room_1_window_2_doors.png' }
];

/**
 * ---------------------------------------------------------
 * CẤU HÌNH FIREBASE REALTIME DATABASE
 * Thay thế firebaseConfig này bằng thông tin từ dự án của bạn.
 * ---------------------------------------------------------
 */
const firebaseConfig = {
    apiKey: "AIzaSyCCbx6cf6UFj8p2JMqylM1SfoDhdHXuqc8",
    authDomain: "roonievsdusty.firebaseapp.com",
    databaseURL: "https://roonievsdusty-default-rtdb.firebaseio.com",
    projectId: "roonievsdusty",
    storageBucket: "roonievsdusty.firebasestorage.app",
    messagingSenderId: "442830169898",
    appId: "1:442830169898:web:91429297229e111f9fe053",
    measurementId: "G-JX0V5FCRRM"
};

// Khởi tạo Firebase (chỉ chạy nếu config hợp lệ, có thể mock nếu lỗi để test UI)
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.warn("Firebase không được khởi tạo (có thể do config giả). Chạy chế độ Offline Mock.");
}

/**
 * ---------------------------------------------------------
 * QUẢN LÝ ÂM THANH (AUDIO MANAGER)
 * ---------------------------------------------------------
 */
const audioManager = {
    bgm: new Audio('https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3'),
    bgm_panic: new Audio('https://cdn.pixabay.com/download/audio/2021/08/09/audio_8233ed008b.mp3'),
    correct: new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3'),
    wrong: new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_c6ccf3232f.mp3'),
    hit: new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_78bd14717b.mp3'),
    win: new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3'),

    init() {
        this.bgm.loop = true;
        this.bgm.volume = 0.3;
        this.bgm_panic.loop = true;
        this.bgm_panic.volume = 0.4;
        this.correct.volume = 0.7;
        this.wrong.volume = 0.7;
        this.hit.volume = 0.8;
        this.win.volume = 1.0;
    },
    play(sound) {
        if (this[sound]) {
            this[sound].currentTime = 0;
            this[sound].play().catch(e => console.log('Tự động phát âm thanh bị trình duyệt chặn:', e));
        }
    },
    stop(sound) {
        if (this[sound]) {
            this[sound].pause();
            this[sound].currentTime = 0;
        }
    }
};
audioManager.init();

// --- TỰ ĐỘNG NHẬN DIỆN TRÌNH DUYỆT (FIX VIEWPORT TRÊN MOBILE) ---
function setVh() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setVh();
window.addEventListener('resize', setVh);

/* ---------------------------------------------------------
 * STATE QUẢN LÝ GAME
 * --------------------------------------------------------- */
const app = {
    role: null, // 'host' hoặc 'student'
    roomId: null,
    myId: null,
    myName: "",
    myScore: 0,
    myQuestionIndex: 0,
    myCombo: 0, // Tính chuỗi câu hỏi đúng liên tiếp
    timeAttackInterval: null,
    isPanicMusic: false,
    questionStartTime: 0, // Lưu thời điểm câu hỏi bắt đầu hiển thị
    currentQuestionOrder: [], // Lệnh xáo trộn đáp án
    isGameStarted: false, // Flag để chống hồi máu Boss khi game đã bắt đầu
    
    // Cài đặt Game
    damagePerHit: 1, // sát thương mỗi câu trả lời đúng
    bossMaxHP: questions.length * 10, // Sẽ tính lại theo số người chơi khi start
    
    // UI Refs
    screens: {
        role: document.getElementById('screen-role'),
        hostLobby: document.getElementById('screen-host-lobby'),
        studentLogin: document.getElementById('screen-student-login'),
        studentLobby: document.getElementById('screen-student-lobby'),
        intro: document.getElementById('screen-intro'),
        game: document.getElementById('screen-game'),
        end: document.getElementById('screen-end'),
        waiting: document.getElementById('screen-waiting')
    },

    // ---------------------- CÁC HÀM TIỆN ÍCH ----------------------
    showScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        }
    },
    
    generateRoomCode() {
        return Math.floor(100000 + Math.random() * 900000).toString(); // 6 chữ số
    },

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    },

    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    // ---------------------- LUỒNG CHỌN VAI TRÒ ----------------------
    selectRole(selectedRole) {
        this.role = selectedRole;
        if (selectedRole === 'host') {
            this.setupHost();
        } else {
            this.showScreen('studentLogin');
        }
    },

    // ---------------------- LUỒNG GIÁO VIÊN (HOST) ----------------------
    setupHost() {
        this.roomId = this.generateRoomCode();
        document.getElementById('display-room-code').innerText = this.roomId;
        this.showScreen('hostLobby');
        
        if (!db) return this.mockHostLobby(); // Chế độ test
        
        // Tạo phòng trên Firebase
        const roomRef = db.ref(`rooms/${this.roomId}`);
        roomRef.set({
            gameState: 'lobby',
            bossHP: this.bossMaxHP,
            maxHP: this.bossMaxHP,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });

        // Lắng nghe người chơi vào phòng
        roomRef.child('players').on('value', (snapshot) => {
            const players = snapshot.val() || {};
            this.renderHostPlayerList(players);
            document.getElementById('btn-start-game').disabled = Object.keys(players).length === 0;
            
            // FIX BUGS: Chỉ gán lại máu tối đa khi ở phòng chờ (lobby)
            if (!this.isGameStarted) {
                this.bossMaxHP = Object.keys(players).length * questions.length * this.damagePerHit; // HP = Số học sinh * số câu
                if (this.bossMaxHP === 0) this.bossMaxHP = questions.length * this.damagePerHit;
                roomRef.update({ maxHP: this.bossMaxHP, bossHP: this.bossMaxHP });
            }
        });
    },

    renderHostPlayerList(players) {
        const list = document.getElementById('host-player-list');
        list.innerHTML = '';
        const keys = Object.keys(players);
        document.getElementById('host-player-count').innerText = keys.length;
        keys.forEach(k => {
            const li = document.createElement('li');
            li.innerText = players[k].name;
            list.appendChild(li);
        });
    },

    startGame() {
        this.isGameStarted = true;
        audioManager.play('bgm'); // Bắt đầu phát nhạc nền
        
        if (!db) return this.mockStartGame();
        
        // Đổi trạng thái phòng thành intro
        db.ref(`rooms/${this.roomId}`).update({
            gameState: 'intro'
        });
        
        // Sau 4 giây chuyển sang playing
        setTimeout(() => {
            db.ref(`rooms/${this.roomId}`).update({
                gameState: 'playing'
            });
        }, 4000);
        
        this.listenToGameState();
    },

    // ---------------------- LUỒNG HỌC SINH (STUDENT) ----------------------
    joinRoom() {
        const codeInput = document.getElementById('input-room-code').value.trim().toUpperCase();
        const nameInput = document.getElementById('input-player-name').value.trim();
        const errorDiv = document.getElementById('login-error');
        
        if (!codeInput || !nameInput) {
            errorDiv.innerText = "Vui lòng nhập đủ mã phòng và tên!";
            return;
        }

        this.roomId = codeInput;
        this.myName = nameInput;
        this.myId = this.generateId();

        if (!db) return this.mockStudentJoin();

        const roomRef = db.ref(`rooms/${this.roomId}`);
        roomRef.once('value', (snapshot) => {
            if (!snapshot.exists()) {
                errorDiv.innerText = "Mã phòng không tồn tại!";
                return;
            }
            const data = snapshot.val();
            if (data.gameState !== 'lobby') {
                errorDiv.innerText = "Phòng đã bắt đầu chơi!";
                return;
            }

            // Tham gia thành công
            errorDiv.innerText = "";
            document.getElementById('welcome-player-name').innerText = this.myName;
            this.showScreen('studentLobby');
            
            // Ghi dữ liệu player
            db.ref(`rooms/${this.roomId}/players/${this.myId}`).set({
                name: this.myName,
                score: 0,
                lastHit: 0
            });

            // Lắng nghe ds bạn bè trong lobby
            roomRef.child('players').on('value', (snap) => {
                const players = snap.val() || {};
                const list = document.getElementById('student-player-list');
                list.innerHTML = '';
                Object.keys(players).forEach(k => {
                    const li = document.createElement('li');
                    li.innerText = players[k].name;
                    list.appendChild(li);
                });
            });

            this.listenToGameState();
        });
    },

    // ---------------------- ĐỒNG BỘ TRẠNG THÁI GAME ----------------------
    listenToGameState() {
        const roomRef = db.ref(`rooms/${this.roomId}`);
        
        // Lắng nghe GameState (lobby -> intro -> playing -> ended)
        roomRef.child('gameState').on('value', (snapshot) => {
            const state = snapshot.val();
            if (state === 'lobby') {
                if (this.role === 'host') {
                    this.showScreen('hostLobby');
                } else {
                    this.myQuestionIndex = 0;
                    this.myScore = 0;
                    this.myCombo = 0;
                    this.isPanicMusic = false;
                    audioManager.stop('bgm_panic');
                    this.showScreen('studentLobby');
                }
            } else if (state === 'intro') {
                this.playIntro();
            } else if (state === 'playing') {
                this.startPlaying();
            } else if (state === 'ended') {
                this.showEndScreen();
            }
        });

        // Lắng nghe Máu Boss
        roomRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            
            this.updateBossUI(data.bossHP, data.maxHP);
            this.updateLeaderboardUI(data.players || {});
            
            // Nếu là học sinh đang ở màn hình chờ (đã trả lời xong), update info
            if (this.role === 'student' && this.myQuestionIndex >= questions.length && data.gameState === 'playing') {
                document.getElementById('waiting-boss-hp').innerText = `${data.bossHP}/${data.maxHP}`;
            }

            if (data.bossHP <= 0 && data.gameState === 'playing') {
                if (this.role === 'host') {
                    // Host kích hoạt end game
                    roomRef.update({ gameState: 'ended' });
                }
            }
        });
    },

    playIntro() {
        this.showScreen('intro');
        
        // Add flying animation
        const dustyIntro = document.getElementById('dusty-intro-img');
        if (dustyIntro) {
            dustyIntro.classList.remove('fly-across');
            void dustyIntro.offsetWidth; // trigger reflow
            dustyIntro.classList.add('fly-across');
            
            // Spawn some dust particles periodically while flying
            let dustInterval;
            if (this.role === 'host') {
                dustInterval = setInterval(() => {
                    const rect = dustyIntro.getBoundingClientRect();
                    this.createDustParticles(rect.left + rect.width/2, rect.top + rect.height/2, 3);
                }, 300);
            }
            
            setTimeout(() => {
                if (dustInterval) clearInterval(dustInterval);
            }, 3000);
        }
    },

    startPlaying() {
        this.showScreen('game');
        this.isGameStarted = true;
        audioManager.play('bgm'); // Học sinh bắt đầu nghe nhạc khi vào game chính
        
        // Cài đặt lại giao diện nếu chơi lại
        document.getElementById('screen-end').style.display = 'none';
        const bgImg = document.getElementById('fallback-bg');
        if (bgImg) bgImg.src = 'assets/bg-dirty.jpeg';
        
        const dusty = document.getElementById('dusty-img');
        if (dusty) {
            dusty.src = 'assets/dusty-angry.png';
            dusty.classList.remove('dusty-dead');
        }
        
        const ronnie = document.getElementById('ronnie-img');
        if (ronnie) {
            ronnie.src = 'assets/ronnie-idle.png';
        }

        // Set up View
        if (this.role === 'host') {
            document.getElementById('host-view-panel').style.display = 'flex';
            document.getElementById('student-view-panel').style.display = 'none';
        } else {
            document.getElementById('host-view-panel').style.display = 'none';
            document.getElementById('student-view-panel').style.display = 'flex';
            this.loadQuestion();
        }
        
        document.getElementById('total-questions').innerText = questions.length;
    },

    // ---------------------- HỌC SINH LÀM BÀI ----------------------
    loadQuestion() {
        if (this.myQuestionIndex >= questions.length) {
            // Cập nhật trạng thái hoàn thành lên Firebase
            if (db) {
                db.ref(`rooms/${this.roomId}/players/${this.myId}`).update({ isFinished: true });
            }
            
            // Hết câu hỏi -> Chuyển sang màn chờ cổ vũ
            this.showScreen('waiting');
            document.getElementById('waiting-my-score').innerText = this.myScore;
            return;
        }

        const q = questions[this.myQuestionIndex];
        document.getElementById('question-number').innerText = this.myQuestionIndex + 1;
        document.getElementById('question-text').innerText = q.q;
        
        // Bắt đầu đếm thời gian cho câu hỏi hiện tại
        this.questionStartTime = Date.now();
        
        // --- TÍNH NĂNG: QUÁI VẬT PHẢN CÔNG (DUST ATTACK) ---
        // Trừ câu đầu tiên, có xác suất 30% Boss sẽ tung chiêu ném bụi
        if (this.myQuestionIndex > 0 && Math.random() < 0.3) {
            this.triggerDustAttack();
        }

        // --- TÍNH NĂNG: CÂU HỎI BOM NỔ CHẬM ---
        if (this.timeAttackInterval) clearInterval(this.timeAttackInterval);
        document.getElementById('student-view-panel').classList.remove('time-attack-mode');
        document.getElementById('time-attack-timer').style.display = 'none';

        if (this.myQuestionIndex > 0 && Math.random() < 0.2) {
            this.triggerTimeAttack();
        }

        if (q.image) {
            document.getElementById('question-image').src = q.image;
            document.getElementById('question-image').style.display = 'block';
        } else {
            document.getElementById('question-image').style.display = 'none';
        }

        // Trộn đáp án theo số lượng options thực tế
        const order = Array.from({length: q.options.length}, (_, i) => i);
        this.currentQuestionOrder = this.shuffleArray(order);
        
        const grid = document.getElementById('options-grid');
        grid.innerHTML = '';
        const labels = ['A', 'B', 'C', 'D'];
        
        this.currentQuestionOrder.forEach((originalIndex, displayIndex) => {
            const btn = document.createElement('button');
            btn.className = 'btn-option';
            btn.innerHTML = `<strong>${labels[displayIndex]}.</strong> ${q.options[originalIndex]}`;
            btn.onclick = () => this.selectOption(originalIndex, btn);
            grid.appendChild(btn);
        });

        document.getElementById('feedback-message').innerText = "";
    },

    triggerTimeAttack() {
        document.getElementById('student-view-panel').classList.add('time-attack-mode');
        const timerEl = document.getElementById('time-attack-timer');
        timerEl.style.display = 'block';
        let timeLeft = 10;
        timerEl.innerText = timeLeft;
        
        this.timeAttackInterval = setInterval(() => {
            timeLeft--;
            timerEl.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(this.timeAttackInterval);
                this.selectOption(-1, null); // Sai vì hết giờ
            }
        }, 1000);
    },

    useUltimate() {
        this.myCombo = 0;
        document.getElementById('btn-ultimate').style.display = 'none';
        document.getElementById('combo-display').style.display = 'none';
        
        const vacuum = document.getElementById('vacuum-container');
        if (vacuum) {
            vacuum.classList.remove('vacuum-sweep-active');
            void vacuum.offsetWidth;
            vacuum.classList.add('vacuum-sweep-active');
        }
        
        audioManager.play('hit');
        
        const feedback = document.getElementById('feedback-message');
        feedback.innerText = "TUYỆT CHIÊU! Hút Bụi Khổng Lồ cộng 150 Điểm!";
        feedback.className = "feedback-msg feedback-correct";
        
        const pointsEarned = 150;
        if (db) {
            db.ref(`rooms/${this.roomId}/players/${this.myId}`).update({
                score: this.myScore + pointsEarned
            });
        }
        this.myScore += pointsEarned;
    },

    selectOption(originalIndex, btnElement) {
        // Dừng bom nổ chậm nếu có
        if (this.timeAttackInterval) clearInterval(this.timeAttackInterval);
        document.getElementById('student-view-panel').classList.remove('time-attack-mode');
        document.getElementById('time-attack-timer').style.display = 'none';

        // Khóa các nút khác
        const btns = document.querySelectorAll('.btn-option');
        btns.forEach(b => b.disabled = true);
        
        const q = questions[this.myQuestionIndex];
        const isCorrect = (originalIndex === q.correct);
        const feedback = document.getElementById('feedback-message');
        const comboDisplay = document.getElementById('combo-display');

        if (isCorrect) {
            btnElement.classList.add('correct');
            
            // --- TÍNH NĂNG: CHUỖI COMBO ---
            this.myCombo++;
            let multiplier = 1;
            if (this.myCombo >= 2) {
                multiplier = Math.min(3, 1 + (this.myCombo - 1) * 0.5); // x1.5, x2.0, x2.5, x3.0
                comboDisplay.style.display = 'inline-block';
                comboDisplay.innerText = `Combo x${this.myCombo}! 🔥 (x${multiplier})`;
                comboDisplay.classList.remove('combo-active');
                void comboDisplay.offsetWidth; // trigger reflow
                comboDisplay.classList.add('combo-active');
            }
            
            // --- TÍNH NĂNG: TUYỆT CHIÊU HÚT BỤI ---
            if (this.myCombo >= 5) {
                document.getElementById('btn-ultimate').style.display = 'inline-block';
            } else {
                document.getElementById('btn-ultimate').style.display = 'none';
            }

            // --- TÍNH ĐIỂM (CƠ BẢN + TỐC ĐỘ) ---
            const timeTaken = (Date.now() - this.questionStartTime) / 1000;
            const speedBonus = Math.max(0, Math.floor(10 - timeTaken * (10 / 15))); // Max 10, giảm dần về 0 sau 15s
            const basePoints = 10;
            const totalRawPoints = basePoints + speedBonus;
            
            const pointsEarned = Math.floor(totalRawPoints * multiplier);
            const damageDealt = this.damagePerHit; // Combo không nhân sát thương, chỉ nhân điểm

            const comboText = multiplier > 1 ? `x${multiplier} Combo = ` : '';
            feedback.innerText = `Chính xác! (+${basePoints} cơ bản, +${speedBonus} tốc độ) ${comboText}Nhận ${pointsEarned} điểm!`;
            
            feedback.className = "feedback-msg feedback-correct";
            this.myScore += pointsEarned;
            audioManager.play('correct');
            
            if (db) {
                // Cập nhật điểm và trừ máu boss trên Firebase
                db.ref(`rooms/${this.roomId}/players/${this.myId}`).update({
                    score: this.myScore,
                    lastHit: firebase.database.ServerValue.TIMESTAMP
                });
                
                // Trừ máu dùng transaction để đồng bộ tốt
                const bossRef = db.ref(`rooms/${this.roomId}/bossHP`);
                bossRef.transaction((currentHP) => {
                    return (currentHP || 0) - damageDealt;
                });
            } else {
                this.mockAttack();
            }

        } else {
            // Trả lời sai -> Mất chuỗi Combo
            this.myCombo = 0;
            comboDisplay.style.display = 'none';
            document.getElementById('btn-ultimate').style.display = 'none';

            if (btnElement) {
                btnElement.classList.add('wrong');
                // Hiện đáp án đúng
                const correctDisplayIndex = this.currentQuestionOrder.indexOf(q.correct);
                btns[correctDisplayIndex].classList.add('correct');
            }
            
            if (originalIndex === -1) {
                feedback.innerText = "BÙM! Hết giờ! Dusty đã hút bụi hồi 100 HP!";
                feedback.className = "feedback-msg feedback-wrong";
                audioManager.play('wrong');
                if (db) {
                    const bossRef = db.ref(`rooms/${this.roomId}/bossHP`);
                    bossRef.transaction((currentHP) => Math.min(this.bossMaxHP, (currentHP || 0) + 100));
                }
            } else {
                feedback.innerText = "Sai rồi! Dusty đang cười kìa!";
                feedback.className = "feedback-msg feedback-wrong";
                audioManager.play('wrong');
            }
            
            // Dusty cười (offline mock cũng chạy)
            this.showDustySmile();
        }

        setTimeout(() => {
            this.myQuestionIndex++;
            this.loadQuestion();
        }, 2000);
    },

    // ---------------------- HIỆU ỨNG & CẬP NHẬT GIAO DIỆN CỘT TRÁI ----------------------
    updateBossUI(hp, maxHP) {
        const hpPercent = Math.max(0, (hp / maxHP) * 100);
        document.getElementById('boss-hp-fill').style.width = hpPercent + '%';
        document.getElementById('boss-hp-text').innerText = `${hp}/${maxHP}`;
        
        // Đổi màu phòng từ bẩn sang sạch (current-dirt = hpPercent)
        document.documentElement.style.setProperty('--current-dirt', hpPercent);

        // Hiệu ứng Ronnie vung chổi (nếu hp giảm)
        if (this._lastHP && hp < this._lastHP) {
            this.animateHit(this._lastHP - hp);
            audioManager.play('hit'); // Phát SFX đánh trúng
        }
        this._lastHP = hp;

        // Chuyển nhạc kịch tính khi máu < 30%
        if (hpPercent <= 30 && hp > 0 && !this.isPanicMusic) {
            this.isPanicMusic = true;
            audioManager.stop('bgm');
            audioManager.play('bgm_panic');
        } else if ((hpPercent > 30 || hp <= 0) && this.isPanicMusic) {
            this.isPanicMusic = false;
            audioManager.stop('bgm_panic');
            audioManager.play('bgm');
        }

        // Trạng thái Dusty hoảng sợ nếu dưới 30%
        const dusty = document.getElementById('dusty-character');
        if (hpPercent <= 30 && hp > 0) {
            dusty.classList.add('dusty-panic');
        } else {
            dusty.classList.remove('dusty-panic');
        }
    },

    animateHit(damage) {
        // Cậu bé ném chổi bay tới quái vật
        this.throwDuster();

        // Đổi hình ảnh nhân vật
        const ronnie = document.getElementById('ronnie-img');
        const dusty = document.getElementById('dusty-img');
        
        if (ronnie) ronnie.src = 'assets/ronnie-clean.png';
        if (dusty) dusty.src = 'assets/dusty-hurt.png';

        // Ronnie rung lắc
        const ronnieContainer = document.getElementById('ronnie-character');
        ronnieContainer.classList.remove('ronnie-mop');
        void ronnieContainer.offsetWidth; // trigger reflow
        ronnieContainer.classList.add('ronnie-mop');

        // Dusty rung lắc
        const dustyContainer = document.getElementById('dusty-character');
        dustyContainer.classList.remove('dusty-hit');
        void dustyContainer.offsetWidth;
        dustyContainer.classList.add('dusty-hit');

        // Khôi phục hình ảnh sau 0.6s
        setTimeout(() => {
            if (ronnie) ronnie.src = 'assets/ronnie-idle.png';
            if (dusty) {
                // Kiểm tra máu để chuyển sang mặt sợ hãi hoặc bình thường
                if (this._lastHP && this.bossMaxHP && (this._lastHP / this.bossMaxHP < 0.3)) {
                    dusty.src = 'assets/dusty-scared.png';
                } else {
                    dusty.src = 'assets/dusty-angry.png';
                }
            }
        }, 600);

        // Xóa một vết bẩn ngẫu nhiên
        this.removeRandomDustPatch();

        // Tạo số báo damage bay lên
        const indContainer = document.getElementById('damage-indicators');
        const text = document.createElement('div');
        text.className = 'damage-text';
        text.innerText = `-${damage} HP!`;
        // Random vị trí quanh Dusty
        text.style.left = (40 + Math.random() * 20) + '%';
        text.style.top = (30 + Math.random() * 20) + '%';
        indContainer.appendChild(text);

        setTimeout(() => {
            if(indContainer.contains(text)) indContainer.removeChild(text);
        }, 1500);
    },

    triggerDustAttack() {
        const overlay = document.getElementById('dust-overlay');
        if (!overlay) return;
        
        audioManager.play('wrong'); // Âm thanh báo động
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        
        // Học sinh cần nhấn 5 lần để dọn dẹp
        let clicksNeeded = 5;
        
        overlay.onclick = () => {
            clicksNeeded--;
            overlay.style.opacity = clicksNeeded / 5;
            audioManager.play('hit'); // Âm thanh quét dọn
            
            if (clicksNeeded <= 0) {
                overlay.style.display = 'none';
                overlay.onclick = null; // Clean up listener
            }
        };
    },

    throwDuster() {
        const container = document.getElementById('game-scene');
        const duster = document.createElement('div');
        duster.className = 'flying-duster';
        duster.style.backgroundImage = "url('assets/duster.png')";
        duster.style.backgroundSize = "contain";
        duster.style.backgroundRepeat = "no-repeat";
        duster.style.width = "80px";
        duster.style.height = "80px";
        duster.style.mixBlendMode = "multiply";
        container.appendChild(duster);
        
        setTimeout(() => duster.remove(), 600);
    },

    createDustParticles() {
        const container = document.getElementById('game-scene');
        for (let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.className = 'dust-particle';
            
            // Hướng bay ngẫu nhiên
            const tx = (Math.random() - 0.5) * 400 + 'px';
            const ty = (Math.random() - 0.5) * 400 + 'px';
            particle.style.setProperty('--tx', tx);
            particle.style.setProperty('--ty', ty);
            
            // Xuất phát từ giữa màn hình (nơi Boss đứng)
            particle.style.left = '50%';
            particle.style.top = '30%';
            
            container.appendChild(particle);
            setTimeout(() => particle.remove(), 1500);
        }
    },

    showDustySmile() {
        this.createDustParticles(); // Quái vật phun bụi
        
        const mouth = document.getElementById('dusty-mouth');
        if (!mouth) return;
        const originalD = mouth.getAttribute('d');
        mouth.setAttribute('d', 'M 25,65 Q 40,40 55,65 Z'); // Cười
        
        setTimeout(() => {
            mouth.setAttribute('d', originalD);
        }, 1500);
    },

    async loadRoomBackground() {
        // Obsolete function since we use bg-dirty.jpeg now, but keeping to avoid errors.
    },

    removeRandomDustPatch() {
        // Tìm tất cả các cụm bụi trong SVG
        const patches = document.querySelectorAll('#dust-patches circle');
        if (patches.length > 0) {
            // Lọc ra các cụm chưa bị ẩn
            const visiblePatches = Array.from(patches).filter(p => p.style.opacity !== '0' && p.getAttribute('opacity') !== '0');
            if (visiblePatches.length > 0) {
                const patch = visiblePatches[Math.floor(Math.random() * visiblePatches.length)];
                patch.style.transition = 'opacity 0.5s ease';
                patch.style.opacity = '0';
                patch.setAttribute('opacity', '0');
            }
        }
    },

    updateLeaderboardUI(players) {
        const list = document.getElementById('game-leaderboard');
        list.innerHTML = '';
        
        // Convert map to array and sort by score
        const playersArray = Object.keys(players).map(k => ({ id: k, ...players[k] }));
        playersArray.sort((a, b) => b.score - a.score);

        let finishedCount = 0;

        playersArray.forEach((p, index) => {
            const li = document.createElement('li');
            if (p.id === this.myId) li.classList.add('me');
            if (p.isFinished) finishedCount++;
            
            const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            li.innerHTML = `<span>${rank} ${p.name} ${p.isFinished ? '✅' : ''}</span> <span>${p.score} pt</span>`;
            list.appendChild(li);
        });

        if (this.role === 'host') {
            const statusEl = document.getElementById('host-completion-status');
            if (statusEl) {
                statusEl.innerText = `Đã hoàn thành: ${finishedCount}/${playersArray.length} học sinh`;
            }
        }

        return playersArray; // return for end screen
    },

    // ---------------------- END SCREEN ----------------------
    endGameEarly() {
        if (confirm("Giáo viên: Bạn có chắc chắn muốn kết thúc trò chơi ngay lập tức không?")) {
            if (db && this.roomId) {
                db.ref(`rooms/${this.roomId}`).update({ gameState: 'ended' });
            } else {
                this.showEndScreen();
            }
        }
    },

    showEndScreen() {
        // Thay vì ẩn hết screen, ta chỉ hiện popup đè lên screen-game
        document.getElementById('screen-end').style.display = 'flex';
        
        const dusty = document.getElementById('dusty-img');
        if (dusty) dusty.src = 'assets/dusty-hurt.png';
        
        const ronnie = document.getElementById('ronnie-img');
        if (ronnie) ronnie.src = 'assets/ronnie-celebrate.png';
        
        // Đổi hình nền phòng sạch
        const bgImg = document.getElementById('fallback-bg');
        if (bgImg) bgImg.src = 'assets/bg-clean.jpeg';

        this.createConfetti();
        
        audioManager.stop('bgm');
        audioManager.play('win');

        // Rút data cuối cùng từ Firebase (nếu dùng)
        if (db) {
            db.ref(`rooms/${this.roomId}/players`).once('value', snapshot => {
                this.renderFinalLeaderboard(snapshot.val() || {});
            });
        } else {
            // Mock
            this.renderFinalLeaderboard(this._mockPlayers);
        }
    },

    renderFinalLeaderboard(playersMap) {
        const players = Object.keys(playersMap).map(k => ({id: k, ...playersMap[k]}));
        players.sort((a, b) => b.score - a.score);

        // Podium Top 3 (SVG)
        if (players[0]) { document.getElementById('podium-name-1').textContent = players[0].name; document.getElementById('podium-score-1').textContent = players[0].score + 'đ'; }
        if (players[1]) { document.getElementById('podium-name-2').textContent = players[1].name; document.getElementById('podium-score-2').textContent = players[1].score + 'đ'; }
        if (players[2]) { document.getElementById('podium-name-3').textContent = players[2].name; document.getElementById('podium-score-3').textContent = players[2].score + 'đ'; }

        // All players list
        const finalUl = document.getElementById('podium-others');
        finalUl.innerHTML = '';
        players.slice(3).forEach((p, index) => {
            const li = document.createElement('li');
            li.style.background = 'rgba(255,255,255,0.2)';
            li.style.padding = '5px 10px';
            li.style.borderRadius = '5px';
            li.innerHTML = `<strong>#${index+4} ${p.name}</strong> (${p.score}đ)`;
            finalUl.appendChild(li);
        });

        if (this.role === 'host') {
            document.getElementById('btn-restart-game').style.display = 'inline-block';
        }
    },

    resetGame() {
        if (!db) { location.reload(); return; }
        const roomRef = db.ref(`rooms/${this.roomId}`);
        roomRef.update({
            gameState: 'lobby',
            bossHP: this.bossMaxHP
        });
        roomRef.child('players').once('value', snap => {
            const players = snap.val();
            if (players) {
                const updates = {};
                Object.keys(players).forEach(k => {
                    updates[`${k}/score`] = 0;
                    updates[`${k}/lastHit`] = 0;
                    updates[`${k}/isFinished`] = false;
                });
                roomRef.child('players').update(updates);
            }
        });
    },

    createConfetti() {
        const container = document.createElement('div');
        container.id = 'confetti-container';
        document.getElementById('screen-end').appendChild(container);
        
        const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
        
        for (let i = 0; i < 100; i++) {
            const conf = document.createElement('div');
            conf.className = 'confetti';
            conf.style.left = Math.random() * 100 + 'vw';
            conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
            conf.style.animationDelay = Math.random() * 2 + 's';
            container.appendChild(conf);
        }
    },

    // ---------------------- MOCK FUNCTIONS (CHẠY OFFLINE NẾU KHÔNG CÓ FIREBASE) ----------------------
    mockHostLobby() {
        console.log("Mock: Host setup.");
        this.bossMaxHP = 20;
        this._mockPlayers = {
            "1": { name: "Minh Anh", score: 0 },
            "2": { name: "Tuan Kiet", score: 0 }
        };
        this.renderHostPlayerList(this._mockPlayers);
        document.getElementById('btn-start-game').disabled = false;
    },
    mockStartGame() {
        console.log("Mock: Starting game.");
        this.playIntro();
        this._lastHP = this.bossMaxHP;
        setTimeout(() => {
            this.startPlaying();
            this.updateBossUI(this._lastHP, this.bossMaxHP);
            this.updateLeaderboardUI(this._mockPlayers);
        }, 4000);
    },
    mockStudentJoin() {
        console.log("Mock: Student join.");
        this.showScreen('studentLobby');
        document.getElementById('welcome-player-name').innerText = this.myName;
        this.bossMaxHP = 20;
        this._lastHP = 20;
        this._mockPlayers = {};
        this._mockPlayers[this.myId] = { name: this.myName, score: 0 };
        // Giả lập host start sau 3 giây
        setTimeout(() => {
            this.playIntro();
            setTimeout(() => {
                this.startPlaying();
                this.updateBossUI(this._lastHP, this.bossMaxHP);
                this.updateLeaderboardUI(this._mockPlayers);
            }, 4000);
        }, 3000);
    },
    mockAttack() {
        this._mockPlayers[this.myId].score = this.myScore;
        this._lastHP = Math.max(0, this._lastHP - this.damagePerHit);
        this.updateBossUI(this._lastHP, this.bossMaxHP);
        this.updateLeaderboardUI(this._mockPlayers);
        
        if (this._lastHP <= 0) {
            setTimeout(() => this.showEndScreen(), 1000);
        }
    }
};

// Start logic (Init)
app.showScreen('role');
