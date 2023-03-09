//GLOBAL VARIABLES AND CONFIG
alert("Loading TicTacToe");
canvas = document.getElementById('board');
context = canvas.getContext('2d');
context.lineWidth = 5;
board = [];
stateelement = document.getElementById("state"); //tracks whose turn
turn = false;
player = 0;

//START LOOKING FOR THE CURRENT GAME STATE every 5 seconds....
new_ajax_helper('/getstate',statehandler);
intervalId = setInterval(function () { new_ajax_helper('/getstate',statehandler) } ,5000); /* When page loads ping server to get whose turn it is (1 second interval) */

//Reset the game board
reset_board();

endgame.onclick = function(event) {
    new_ajax_helper('/endgame');
};

//reset the board
function reset_board()
{
    board = [[0,0,0],
             [0,0,0],
             [0,0,0]];
    draw_board();
}

//draw a square (Code was got from Chat GPT)
function draw_square(x,y)
{
    context.beginPath();
    context.rect(x*200, y*200, 200, 200);
    context.strokeStyle = 'black';
    context.stroke();
}

//draw a circle (Code was got from Chat GPT)
function draw_circle(x,y)
{
    x = x*200;
    y = y*200;
    context.beginPath();
    context.arc(x+100, y+100, 75, 0, 2*Math.PI);
    context.strokeStyle = 'green';
    context.stroke();
}

//draw a cross (Code was got from Chat GPT)
function draw_cross(x,y)
{
    x = x*200;
    y = y*200;
    context.strokeStyle = 'red';
    centerX = x + 100;
    centerY = y + 100;
    // Draw the first line at a 45-degree angle
    context.beginPath();
    context.moveTo(centerX - 50, centerY - 50);
    context.lineTo(centerX + 50, centerY + 50);
    context.stroke();
    // Draw the second line at a 45-degree angle
    context.beginPath();
    context.moveTo(centerX + 50, centerY - 50);
    context.lineTo(centerX - 50, centerY + 50);
    context.stroke();
}

//draw the board
function draw_board()
{
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (row=0; row < board.length; row++)
    {
        for (col=0; col < board[row].length; col++)
        {
            draw_square(col,row);
            if (board[row][col] == 1)
            {
                draw_circle(col,row);
            }
            else if (board[row][col] == 2)
            {
                draw_cross(col,row);
            }
        }
    }
}

// Add a click event listener to the canvas
canvas.onclick = function(event)
{
    if (turn == false)
    {
        return //dont allow clicks until its your turn
    }
    // Get the mouse position relative to the canvas
    rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;

    x = Math.trunc(mouseX / 200); //make x = 0,1,2
    y = Math.trunc(mouseY / 200); //make y = 0,1,2

    if (player == 1) //player 1
    {
        draw_circle(x,y);
        board[y][x] = 1;
    } else if (player == 2) //player 2
    {
        draw_cross(x,y);
        board[y][x] = 2;
    }
    turn = false;

    //checks for victory
    checkforvictory();

    //Send new state of board to server using JSON and AJAX
    formobject = new FormData(); //create a form object
    formobject.append("gamedata", JSON.stringify(board)); //email is a textinput tag value
    new_ajax_helper('/maketurn',defaulthandler,formobject);
    stateelement.innerHTML = "Waiting for other player to have their turn."
    
    //Start checking game state for your turn again
    intervalId = setInterval(function () { new_ajax_helper('/getstate',statehandler) } ,5000);
}

//Determines who won
function victory()
{
    draw = true; //assume a draw but if there is even 1 zero (empty space) is found then draw is not true
    columnsum = [1,1,1];

    //Check the rows, also calculate column sums
    for (row=0; row < board.length; row++)
    {
        rowsum = 1;
        for (col=0; col<board[row].length; col++)
        {
            rowsum = rowsum*board[row][col];
            columnsum[col] = columnsum[col] * board[row][col];
            if (board[row][col] == 0)
                draw = false;
        }
        if (rowsum == 1)
        {
            return 1; //exit the function
        } else if (rowsum == 8)
        {
            return 2; //exit the function
        }
    }

    //Check the columns
    for (i=0; i<columnsum.length; i++)
    {
        if (columnsum[i] == 1)
        {
            return 1;
        }
        else if (columnsum[i] == 8)
        {
            return 1;
        }
    }

    //Now check the diagonals
    diagonal2 = board[2][0]*board[1][1]*board[0][2];
    diagonal1 = board[0][0]*board[1][1]*board[2][2];
    if (diagonal1 == 1 || diagonal2 == 1)
    {
        return 1
    } else if (diagonal1 == 8 || diagonal2 == 8)
    {
        return 2
    }

    if (draw == true) //if it gets this far, and no zeros were detected, than a draw must have occurred
    {
        return 3
    }
    return 0
}

//check to see who won
function checkforvictory()
{
    //Check for victory - ideally this should be done on the web server
    v = victory();
    if (v == 0)
    {
        //do nothing
    } else { //victory or draw has occurred
        if (v == 1)
        {
            alert("Player 1 wins!");
        } else if (v == 2)
        {
            alert("Player 2 wins!");
        } else if (v == 3)
        {
            alert("Draw!")
        }
        reset_board();
    }
}

//receive the state of the game from the server
function statehandler(result)
{
    console.log(result);

    //Get state of the game
    if (result.state == "waiting")
    {
        stateelement.innerHTML = "Waiting for player to join!";
    } 
    else if (result.state == "ended")
    {
        alert("Other player has left the game!");
        window.location = "lobby.html";
    } 
    else if (result.state == "yourturn")
    {
        checkforvictory();
        player = result.player; //kind of unnecessary
        turn = true;
        clearInterval(intervalId); //stop checking game state
        stateelement.innerHTML = "It's your turn";
        if (result.gamedata != null) //if not a new game
            board = JSON.parse(result.gamedata); //update the board
        draw_board();
    } 
    else if (result.state == "returntologin")
    {
        window.location = "/login";
    } 
    else if (result.state == "returntolobby")
    {
        window.location = "/lobby";
    }
    return
}

