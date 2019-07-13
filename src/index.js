import app from 'express';
import http from 'http';
import socketio from 'socket.io';
import Container, {connectContainer} from './Container';
import createSeedableContainer from './SeedableContainer';

const PORT = 3333;

const containerHolder = new (createSeedableContainer({
    createContainer: () => {
        const reducer = (state, action) => {
            switch(action.type){
                case "ADD":
                    return {...state, serval: state.serval+1};
                default:
                    return state;
            }
        }
        
        const container = new Container({defaultState: {serval: 21, value: 1}, reducer});
        setInterval(() => {
            container.dispatch({
                type: "ADD"
            });
        }, 1000);        
        return container;
    }
}))();

const server = http.createServer(app);
const io = socketio(server);


const ns_1 = io.of("/container");
ns_1.on('connection', socket => { 
    console.log('connected client');
    let removeListeners;
    socket.on('initseed', (data) => {
        console.log(`received INITSEED`, JSON.stringify(data));
        removeListeners = containerHolder.attach(socket, data);
    });

    socket.on('disconnect', () => {
        console.log('received DISCONNECT');
        if(removeListeners)
            removeListeners();
    })
});

console.log(`START LISTENING ON PORT ${PORT}`)
server.listen(PORT);

