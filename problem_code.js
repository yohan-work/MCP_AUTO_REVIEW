// MCP 자동 코드 리뷰 테스트용 - 추가 문제 코드 버전 3.0

// 전역 변수 (과도하게 사용)
var globalCounter = 0;
var globalData = [];
let globalFlag = false;
const GLOBAL_CONSTANT = "이 값은 절대 변경되지 않습니다";
var evenMoreGlobals = {}; // 추가된 전역 변수
let superGlobalConfig = { debug: true, logLevel: 'ALL', tracing: true }; // 또 다른 전역 변수

// 보안 취약점: 하드코딩된 비밀번호
const API_KEY = "abcdef123456";
const DATABASE_PASSWORD = "admin123";

// TODO: 이 함수를 리팩토링하고 성능 최적화 필요
function initializeApplication() {
    console.log("애플리케이션 초기화 중...");
    console.trace("초기화 스택 트레이스");
    
    // 미사용 변수 - 선언했지만 사용하지 않음
    const unusedConfig = {
        debug: true,
        logLevel: "verbose",
        timeout: 5000
    };
    
    // 더 많은 미사용 변수 추가
    const anotherUnused = "이 문자열은 사용되지 않습니다";
    const configSettings = { maxRetries: 5, timeout: 10000 };
    const debugMode = true && false && true; // 복잡한 불필요 표현식
    
    // 너무 긴 한 줄 (100자 초과)
    const veryLongString = "이것은 매우 긴 문자열로, 한 줄에 너무 많은 내용이 포함되어 있어 코드 가독성을 해칩니다. 줄 길이 제한을 초과하고 있어 좋지 않은 코드 스타일의 예입니다.";
    
    // 명확하지 않은 변수명
    let a = 5;
    let b = 10;
    let c = a + b;
    let x = [];
    let y = {};
    let z = "";
    
    setupEventListeners();
    
    return "초기화 완료";
}

// 메모리 누수 가능성 - addEventListener만 있고 removeEventListener가 없음
function setupEventListeners() {
    console.log("이벤트 리스너 설정 중...");
    console.warn("이 함수는 메모리 누수를 일으킬 수 있습니다!");
    
    document.getElementById("myButton").addEventListener("click", function() {
        console.log("버튼이 클릭되었습니다!");
        processData();
    });
    
    document.getElementById("myInput").addEventListener("change", function() {
        console.log("입력값이 변경되었습니다!");
        const value = document.getElementById("myInput").value;
        validateInput(value);
    });
    
    // 새로운 이벤트 리스너 추가 (제거 로직 없음)
    window.addEventListener("resize", function() {
        console.log("창 크기가 변경되었습니다!");
    });
    
    // 추가 이벤트 리스너
    document.addEventListener("scroll", function() {
        console.log("스크롤 이벤트 발생!");
    });
    
    // 더 많은 리스너... 하지만 제거 로직 없음
}

// 너무 긴 함수 - 한 가지 일만 해야 하는 함수가 여러 가지 작업을 수행
function processData() {
    console.log("데이터 처리 중...");
    console.log("업데이트된 함수입니다");
    
    // 더 많은 콘솔 로그
    console.log("처리 단계 1");
    console.log("처리 단계 2");
    console.log("처리 단계 3");
    console.debug("디버그 정보");
    console.info("정보 메시지");
    
    // 임의의 데이터 생성
    let data = [];
    for (let i = 0; i < 1000; i++) {
        data.push({
            id: i,
            value: Math.random() * 100,
            timestamp: Date.now()
        });
    }
    
    // 데이터 정렬
    data.sort((a, b) => a.value - b.value);
    console.log("데이터 정렬 완료");
    
    // 일부 데이터 필터링
    const filteredData = data.filter(item => item.value > 50);
    console.log("데이터 필터링 완료");
    
    // 데이터 변환
    const transformedData = filteredData.map(item => {
        return {
            ...item,
            processed: true,
            score: item.value * 1.5
        };
    });
    console.log("데이터 변환 완료");
    
    // 통계 계산
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    
    for (const item of transformedData) {
        sum += item.value;
        max = Math.max(max, item.value);
        min = Math.min(min, item.value);
    }
    
    const avg = sum / transformedData.length;
    console.log("통계 계산 완료");
    
    // 복잡한 중첩 조건문
    if (transformedData.length > 0) {
        if (avg > 70) {
            if (max > 95) {
                console.log("고품질 데이터 세트");
                if (min > 60) {
                    console.log("매우 일관된 데이터");
                    if (transformedData.length > 100) {
                        console.log("대규모 고품질 데이터");
                    }
                }
            } else {
                console.log("중간 품질 데이터 세트");
            }
        } else {
            console.log("저품질 데이터 세트");
        }
    }
    
    // 개선이 필요한 깊은 중첩 반복문
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            for (let k = 0; k < 10; k++) {
                console.log(`[${i}, ${j}, ${k}] 처리 중...`);
                // 아무 작업도 하지 않음
            }
        }
    }
    
    // 결과 저장
    globalData = transformedData;
    globalCounter++;
    
    return transformedData;
}

// 미완성 함수 (TODO 주석)
function validateInput(input) {
    // TODO: 입력값 검증 로직 구현 필요
    console.log("입력값 검증 중:", input);
    // TODO: 여기에 정규식 검증 추가 필요
    // TODO: 보안 검증 추가 필요
    // TODO: XSS 방어 로직 구현
    return true;
}

// 보안 취약점 - 위험한 eval 사용
function executeUserScript(script) {
    console.log("사용자 스크립트 실행 중...");
    return eval(script); // 매우 위험한 코드
}

// SQL 인젝션 취약점
function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = " + userId; // SQL 인젝션 취약점
    console.log("실행할 쿼리:", query);
    return { id: userId, name: "테스트 사용자" };
}

// 무한 루프 가능성이 있는 함수
function riskyOperation(data) {
    let result = [];
    let index = 0;
    
    // 종료 조건 실수 - i가 아닌 index를 증가시켜야 함
    for (let i = 0; i < data.length; i) {
        result.push(data[index] * 2);
        // index++; // 이 라인이 주석 처리되어 있어 무한 루프 발생 가능
    }
    
    return result;
}

// 낭비적인 리소스 사용 함수
function inefficientOperation() {
    let result = 0;
    
    // 불필요하게 큰 배열 생성
    const hugeArray = new Array(1000000).fill(0).map(() => Math.random());
    
    // 비효율적인 배열 순회 (여러 번 반복)
    for (let i = 0; i < 100; i++) {
        for (const item of hugeArray) {
            result += item;
        }
    }
    
    return result;
}

// 주석 없는 복잡한 정규식
function parseComplexData(input) {
    return input.replace(/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/gi, 'EMAIL_REMOVED')
               .replace(/^\+?([0-9]{1,3})?[-. ]?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, 'PHONE_REMOVED');
}

// 새로 추가된 문제가 있는 함수
function potentialBug(a, b) {
    // 잠재적 버그: == 사용 (=== 사용해야 함)
    if (a == b) {
        return true;
    }
    return false;
}

// 타입 안전성 부족 코드
function addNumbers(a, b) {
    return a + b; // 문자열을 넣으면 연결 연산이 됨
}

// 주석과 코드 불일치
// 이 함수는 숫자를 제곱합니다.
function multiplyNumbers(a, b) {
    return a * b; // 주석과 실제 기능 불일치
}

// 메인 애플리케이션 초기화
initializeApplication();
console.log("애플리케이션이 준비되었습니다!");
console.log("추가 로그 메시지");
console.warn("경고: 이 코드는 예제용으로만 사용하세요.");

// 실수로 디버그용 테스트 코드를 남겨둠
if (true) {
    console.log("이것은 디버그 모드입니다");
    debugger; // 디버거 문이 남겨져 있음
}

// 마지막 줄이 매우 길어서 가독성이 떨어지는 예
const finalResult = processData() && validateInput("test") && console.log("모든 과정이 성공적으로 완료되었습니다!") && { status: "success", timestamp: new Date().toISOString(), counter: globalCounter, data: globalData.length > 0 ? globalData.slice(0, 10) : [], message: "이 줄은 의도적으로 매우 길게 작성되어 있어서 코드 리뷰에서 줄 길이 경고를 발생시킬 것입니다. 수정 버전에서는 더 길게 만들었습니다. 이제 세 번째 버전에서는 훨씬 더 길어졌습니다. 파일의 마지막에 극도로 긴 한 줄을 추가하여 코드 가독성을 해치는 예시를 보여줍니다." }; 