function evaluateAnswer(index, correctAnswer, selectedAnswer) {console.log('test');
    const statusDiv = document.getElementById('status-' + index);
    const viewAnswerButton = document.getElementById('view-answer-' + index);
    if (selectedAnswer === correctAnswer) {
        statusDiv.innerHTML = '<p id="correct">Correct</p>';
        viewAnswerButton.style.display = 'none';
    } else {
        statusDiv.innerHTML = '<p id="wrong">Wrong</p>';
        viewAnswerButton.style.display = 'block';
    }
}

function viewAnswer(index, correctAnswer) {
    const statusDiv = document.getElementById('status-' + index);
    statusDiv.innerHTML += '<p>Correct Answer: ' + correctAnswer + '</p>';
    const viewAnswerButton = document.getElementById('view-answer-' + index);
    viewAnswerButton.style.display = 'none';
}
