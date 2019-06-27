import app from 'express';
import http from 'http';
import socketio from 'socket.io';
import Container, {connectContainer} from './Container';

const PORT = 3333;



const server = http.createServer(app);

const io = socketio(server);

const reducer = (state, action) => {
    switch(action.type){
        case "ADD":
            return {...state, serval: state.serval+1};
        default:
            return state;
    }
}

const data_container = new Container({defaultState: {serval: 21, value: 1}, reducer});

setInterval(() => {
    data_container.dispatch({
        type: "ADD"
    });
}, 1000);

const ns_1 = io.of("/container_1");
ns_1.on('connection', socket => { 
    connectContainer(data_container, socket);
});

console.log(`START LISTENING ON PORT ${PORT}`)
server.listen(PORT);

