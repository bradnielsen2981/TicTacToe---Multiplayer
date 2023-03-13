//----------------INITIALISING THE GAME-----------------------------------------
alert("Loading Game");
canvas = document.getElementById('board'); //where drawing occurs
context = canvas.getContext('2d');
context.lineWidth = 5; //sets drawing to use a common linewidth
//img = new Image(); img.src = 'path/to/your/image.jpg'; //This code can be used to load an image to draw on a canvas
board = [[0,0,0],
         [0,0,0],
         [0,0,0]];//this will be the game data
scores = [0,0]; //scores of player 1 and player 2
stateelement = document.getElementById("state"); //used to write on screen whose turn it is
turn = false; //turn will be set to true if its the players turn
player = 0; //player will be set to an id of 1 or 2 after game state is checked
reset_board(); //reset the game board
intervalId = 0; //A handle for repeatedly pinging the server for the state of the game.
listenForGameState(); //Listen for game state every 5 seconds....this will tell the player if its their turn

//------------------------------------------------------------------------------

//---------------DRAWING FUNCTIONS FOR THE GAME --------------------------------

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

//draw an image on a canvas (Code was got from Chat GPT) - not being used
function draw_image(x,y)
{
    // Draw the image on the canvas at position (0, 0). img is a global variable see the initialisation
    context.drawImage(img, x, y);
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

//----------------GAME LOGIC FUNCTIONS----------------------------------------------

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
            return 2;
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
function checkForVictory()
{
    //Check for victory - ideally this should be done on the web server but easier for students if not
    v = victory();
    if (v == 0)
    {
        //do nothing
    } else { //victory or draw has occurred
        
        if (v == 1)
        {
            if (player == 1) {
                alert("You win!");
                scores[0] = scores[0] + 1;
            } else { 
                alert("You lose!"); 
            }
        } else if (v == 2) {
            if (player == 2) 
            {
                alert("You win!");
                scores[1] = scores[1] + 1;
            } else { 
                alert("You lose!"); 
            }
        } else if (v == 3)
        {
            alert("Draw!")
        }
        saveScoreData();
        reset_board();
    }
}

//------------SEND AND RECEIVES DATA FROM SERVER--------------------------------------
//Listen for game state every 5 seconds....this will tell the player if its their turn, and get the state of the game
function listenForGameState()
{
    intervalId = setInterval(function () { new_ajax_helper('/getstate',statehandler) } ,5000);
}

//receive the state of the game from the server - try not to change this function
function statehandler(result)
{
    console.log(result);
    //Get state of the game
    if (result.state == "waiting")
    {
        stateelement.innerHTML = "Waiting for your turn..";
    } 
    else if (result.state == "ended")
    {
        alert("Other player has left the game!");
        window.location = "lobby.html";
    } 
    else if (result.state == "yourturn")
    {
        stateelement.innerHTML = "It's your turn";
        clearInterval(intervalId); //stop checking game state
        checkForVictory(); //player might have already lost
        player = result.player; //always getting the player id is kind of unnecessary but saves a lot of code
        turn = true;
        if (result.gamedata != null) //if not a new game
            board = JSON.parse(result.gamedata); //update the board
        draw_board();
    } 
    return
}

//gets game data to the server to be stored as a JSON string
function sendGameData()
{
    //Send new state of board to server using JSON and AJAX
    formobject = new FormData(); //create a form object
    formobject.append("gamedata", JSON.stringify(board)); //email is a textinput tag value
    new_ajax_helper('/maketurn',defaulthandler,formobject); //defaulthandler will console.log any return data
}

//end the game on the server, and tells the other player game has ended
function endGame()
{
    new_ajax_helper('/endgame');
}

//save both players scores onto the server
function saveScoreData()
{
    //Send new state of board to server using JSON and AJAX
    formobject = new FormData(); //create a form object
    formobject.append("scoredata", JSON.stringify(scores)); //email is a textinput tag value
    new_ajax_helper('/savescoredata',defaulthandler,formobject);
}

//gets both players score data
function getScoreData()
{
    new_ajax_helper('/getscoredata',scoreDataHandler);
}

//handlers the school data
function scoreDataHandler(result)
{
    scores = JSON.parse(result.scoredata); 
}

//-------EVENT LISTENERS ON PAGE--------------------------------------------
//Event listens listen for events and then call functions of code in response....
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
    checkForVictory(); //checks for victory
    sendGameData(); // send the game data to the server...
    stateelement.innerHTML = "Waiting for other player to have their turn.";
    listenForGameState(); //now that turn is finished listen for the game state, and your next turn
}

endgame.onclick = function(event) {
    clearInterval(intervalId); //stop checking game state
    endGame();  
};

//stupid function should be part of javascript standard library
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }