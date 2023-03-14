#---PYTHON LIBRARIES FOR IMPORT--------------------------------------------------------------
import uuid, sys, logging, math, time, os, re, json, random, string
from flask import Flask, render_template, session, request, redirect, url_for, flash, jsonify, send_from_directory
from datetime import datetime, timedelta, timezone
import helpers
from databaseinterface import Database
from werkzeug.utils import secure_filename #for secure file storage
#-----------------------------------------------------------------------------------------------

DEBUG = True

#---CONFIGURE APP---------------------------------------------------------------------------------
sys.tracebacklimit = 1
app = Flask(__name__)
app.config['SECRET_KEY'] = 'some random string' #used for session cookies
logging.basicConfig(filename='logs/log.txt', level=logging.INFO)
DATABASE = Database('game.sqlite', app.logger) #connect database

#-----HELPER FUNCTIONS-------------------------------------------------------------------------
def log(message):
    app.logger.info(message)
    return

def log_error(message):
    app.logger.error(message)
    return

#check to see if the user is in a game and if not, redirect
def check_game_permission():
    if 'userid' not in session:
        return redirect('./login')
    if 'gameid' not in session:
        return redirect('./lobby')
    return



#-------------------------------------------------------------------------------------------
# BACKDOOR
@app.route('/backdoor', methods=['GET','POST'])
def backdoor():
    userdetails = DATABASE.ViewQuery("SELECT * FROM users") #returns a list of dictionaries
    return jsonify(userdetails) #change to a string

#---------------------------------------------------------------------------------------------
# LOGIN PAGE
@app.route('/', methods=['GET','POST'])
def login():
    if 'userid' in session: #if userid in session, then redirect to lobby
        return redirect('./lobby') # a dot before the url means: Do not carry form data

    if request.method == "POST":   #if post data has been sent
        email = request.form.get("email")   #get variables from post data
        password = request.form.get("password")

        userdetails = DATABASE.ViewQuery("SELECT * FROM users WHERE email = ?", (email,)) #returns a list of dictionaries
        if userdetails: #if results
            user = userdetails[0] #get top row
            if helpers.check_password(user['password'], password): #check password against hash
                session['userid'] = user['userid'] #store session variables
                session['permission'] = user['permission']
                session['username'] = user['username']
                return redirect('./lobby')
            else:
                flash('No user found!')
    return render_template('login.html')

#-------------------------------------------------------------------------------------
@app.route('/logoff', methods=['GET','POST'])
def logoff():
    session.clear()
    return redirect('./')

#--------------------------------------------------------------------------------------
# REGISTER PAGE
@app.route('/register', methods=['GET','POST'])
def register():
    if 'userid' in session: #if userid in session, then redirect to lobby
        return redirect('./lobby')

    if request.method == "POST":
        password = request.form.get('password')
        passwordconfirm = request.form.get('passwordconfirm')
        if password != passwordconfirm:
            flash('Passwords do not match!')
            return render_template('register.html')
        username = request.form.get('username')
        email = request.form.get('email')

        results = DATABASE.ViewQuery('SELECT * FROM users WHERE email = ? OR username =?',(email, username)) #check to see if user already exists
        if results:
            flash('Username or email already exists')
        else:
            password = helpers.hash_password(password) #hash the password
            DATABASE.ModifyQuery('INSERT INTO users (username, password, email) VALUES (?,?,?)',(username, password, email))
            return redirect('./') #redirect to login
    return render_template('register.html')

#----------------------------------------------------------------------------------------
# ADMIN PAGE
@app.route('/admin', methods=['GET','POST'])
def admin():
    if 'permission' in session:
        if session['permission'] != 'admin':
            return redirect('./') #not admin
    else:
        return redirect('./') #not logged in
    userdata = DATABASE.ViewQuery('SELECT * from users') #list of dictionary
    gamedata = DATABASE.ViewQuery('SELECT * from games') #list of games

    if request.method == 'POST':
        users = request.form.getlist('deleteuser') #delete users based on user id
        for user in users:
            DATABASE.ModifyQuery('DELETE FROM users WHERE userid = ?',(user,))
        games = request.form.getlist('deletegame') #delete games based on game id
        for game in games:
            DATABASE.ModifyQuery('DELETE FROM games WHERE gameid = ?',(game,))
        return redirect('./admin')

    return render_template('admin.html', userdata=userdata, gamedata=gamedata)


#---------------------------------------------------------------------------------------
# LOBBY
@app.route('/lobby', methods=['GET','POST'])
def lobby():
    opengamelist = None
    if 'gameid' in session:
        return redirect('./game')

    #get open games where the current user did not create the game. When a user has created the game they exit the lobby
    opengamelist = DATABASE.ViewQuery("SELECT games.gameid, games.gamecode, games.gametype, users.username FROM games INNER JOIN users ON games.playerid1=users.userid WHERE games.playerid2 = 0 AND users.userid != ?", (session['userid'],))

    if request.method == 'POST':
        command = request.form.get('command') #hidden field on page with value of joingame or creategame based on which form was submitted

        if command == 'joingame': #the player who joins is automatically player 2
            gameid = request.form.get('opengame') #this should have been selected
            if gameid != '0': #player has chosen a game to join
                session['gameid'] = gameid #store the game id
                turn = random.randint(1,2) #choose whose turn it is once two players have connected
                session['player'] = "2"
                DATABASE.ModifyQuery('UPDATE games SET playerid2 = ?, turn = ? WHERE gameid = ? ', (session['userid'], turn, gameid))
                return redirect('./game')

        elif command == 'creategame': #the player who creates is automatically player 1
            gametype = request.form.get('gametype')
            playerid1 = session['userid']
            code = str(datetime.timestamp(datetime.now())*1000*playerid1) #create a unique game code - this could be used at some point
            gamecode = helpers.hash_password(code)[0:5]
            createtime = datetime.now() #should this be a timestamp? hmm?
            session['player'] = "1"
            DATABASE.ModifyQuery('INSERT INTO games (gamecode,playerid1,playerid2,createtime,gametype) VALUES (?,?,0,?,?)', (gamecode,playerid1,createtime,gametype))
            result = DATABASE.ViewQuery("SELECT MAX(gameid) as gameid FROM games")[0] # <-remember its a list of dictionaries - get the first dictionary
            session['gameid'] = result['gameid'] #get the new game id and save into the session
            return redirect('./game')

    flash(session)
    return render_template('lobby.html', opengamelist=opengamelist)

#-------------------------------------------------------------------------------------
# GAME PAGE
@app.route('/game', methods=['GET','POST'])
def game():
    check_game_permission()
    if DEBUG:
        flash(session)
    return render_template('game.html') #loads up the game menu

#--------------------------------------------------------------------------------------
# CHECK FOR TURN
@app.route('/getstate', methods=['GET','POST'])
def getstate():
    if 'userid' not in session:
        return 
    if 'gameid' not in session:
        return 
    data = { "state":"waiting" }
    games = DATABASE.ViewQuery("SELECT * FROM games WHERE gameid = ?", (session['gameid'],)); game = games[0]; 
    #TO DO : Update last access time of game - can be used to end or delete games after a long period of inactivity
    
    if game['ended'] == 1:
        data = { "state":"ended" }
        del session['gameid']
        return jsonify(data)
    
    if game['turn'] == 1 and game['playerid1'] == session['userid']:
        log("Player 1 turn - (USERID: " + str(session['userid']))
        data = { "state":"yourturn", "player":1, "gamedata":game['gamedata'], "scoredata":game['scoredata'] } #always sending which player they are is redundant but simpler this way
        return jsonify(data)
    
    elif game['turn'] == 2 and game['playerid2'] == session['userid']:
        log("Player 2 turn - (USERID: " + str(session['userid']))
        data = { "state":"yourturn", "player":2,  "gamedata":game['gamedata'], "scoredata":game['scoredata'] }
        return jsonify(data)
    
    return jsonify(data)

#--------------------------------------------------------------------------------------
# MAKE TURN - saves game data
@app.route('/maketurn', methods=['GET','POST'])
def maketurn():
    if 'userid' not in session:
        return 
    if 'gameid' not in session:
        return 
    data = { "state":"waiting" }

    if request.method=="POST": #get current game
        games = DATABASE.ViewQuery("SELECT * FROM games WHERE gameid = ?", (session['gameid'],)); game = games[0]
        if game['turn'] == 1:
            turn = 2
        elif game['turn'] == 2:
            turn = 1
        gamedata = request.form.get('gamedata')
        DATABASE.ModifyQuery("UPDATE games SET gamedata = ?, turn = ? WHERE gameid = ?", (gamedata, turn, session['gameid']))
    return jsonify(data)

#--Saves Scores as a JSON String inside the Database----------------------------------
@app.route('/getscoredata', methods=['GET','POST'])
def getscoredata():
    if 'userid' not in session:
        return 
    if 'gameid' not in session:
        return 
    data = None
    if request.method=="POST":
        scoredata = DATABASE.ViewQuery("SELECT scoredata FROM games WHERE gameid = ?", (session['gameid'],)); scoredata = scoredata[0]
    return jsonify(data)

#--Get scores as a JSON String inside the Database------------------------------------
@app.route('/savescoredata', methods=['GET','POST'])
def savescoredata():
    if 'userid' not in session:
        return 
    if 'gameid' not in session:
        return 
    data = None
    scoredata = request.form.get('scoredata')
    DATABASE.ModifyQuery("UPDATE games SET scoredata = ? WHERE gameid = ?",(scoredata, session['gameid']))
    data = { "message":"Scores saved" }
    return jsonify(data)

#---Ends the game, and clears the session data, tells the other player to do the same by setting game to ended
@app.route('/endgame', methods=['GET','POST'])
def endgame():
    data = None
    if 'userid' not in session:
        return 
    if 'gameid' not in session:
        return 
    DATABASE.ModifyQuery("UPDATE games SET ended = 1 WHERE gameid = ?",(session['gameid'],))
    del session['gameid']
    return jsonify(data) 


#--------------------------------------------------------------------------------------
#main method called web server application
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) #runs a local server on port 5000

