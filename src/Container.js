import { createStore, applyMiddleware, compose } from 'redux';
import { compare } from 'fast-json-patch';
import { apply_patch } from 'jsonpatch';
import EventEmitter from 'events';
import uuidv4 from 'uuid/v4';

const DEBUG = true;

const ActionTypes = {
    ACTION_MERGE: "@@MERGE_CLIENT"
};

const actionDiff = (diff, client) => ({
    type: ActionTypes.ACTION_MERGE,
    payload: {
        diff,
        client
    }
});

const defaultReducer = (state) => state;

class Container extends EventEmitter{
    constructor({
        middlewares = [], 
        defaultState = {}, 
        stateAccessor = (s) => s, 
        dispatch = undefined, 
        reducer = defaultReducer 
    } = {}){
        super();

        //all sockets connected to this container
        this._sockets = new Set();

        this._stateAccessor = stateAccessor;

        const self = this;

        const newreducer = (oldstate = defaultState, action) => {
            const state = reducer(oldstate, action);

            if(oldstate != state){
                const diff = compare(oldstate, state);
                self.emit('change', {diff});
            }

            switch(action.type){
                case ActionTypes.ACTION_MERGE:
                    const { diff, client } = action.payload;
                    let retstate = state;
                    try{
                        retstate = apply_patch(state, diff);

                        //notify change for other clients
                        self.emit('change', {diff, client});
                    }catch(e){
                        //error during change >> revert client data
                        self.emit(`replace_${client.id}`, state);
                    }
                    return retstate;
                default:
                    return state;
            }
        };

        //here place your middlewares
        this.store = createStore(newreducer, compose(
                applyMiddleware(...middlewares),
                // other store enhancers if any
            )
        );

        this.dispatch = dispatch || this.store.dispatch.bind(this.store);
    }
    change(data, client){
        if(data.diff){
            this.dispatch(actionDiff(data.diff, client));
        }
    }
    dispatch(action){
        return this.dispatch(action);        
    }
    getState(){
        return this._stateAccessor(this.store.getState());
    }
    attach(socket){
        const eventWithReset = (self, k, f, on = 'on', off = 'off') => {
            self[on].call(self, k, f);
            return () => self[off].call(self, k, f);
        };

        if(this._sockets.has(socket)){
            throw new Error('cannot reattach container to socket for a twice');
        }

        const resets = [];

        this._sockets.add(socket);
        resets.push(() => this._sockets.delete(socket));

        const client = { id: uuidv4() };
        const log = (...msg) => {
            if(DEBUG)
                console.log(`${client.id}:`, ...msg);
        };
    
        const sendChange = (data) => {
            if(!data.client || data.client.id === client.id)
                return;
    
            log("EMIT change", data);
            socket.emit('change', data);
        };
    
        const sendReplace = (state) => {
            const data = {data: state || this.getState()};
            log("EMIT replace", data);
            socket.emit('replace', data);    
        }
        resets.push(
            eventWithReset(this, 'change', sendChange)
        );
        resets.push(
            eventWithReset(this, `replace_${client.id}`, sendReplace)
        )
    
        //send replace on connect
        sendReplace();
    
        resets.push( 
            eventWithReset(socket, 'change', (data) => {
                log("RECV change", data);
                this.change(data, client);
                log(this.getState());
            }) 
        );
    
        resets.push(
            eventWithReset( socket, 'requestReplace', (data) => {
                log("RECV requestReplace", data);
                sendReplace();
            })
        );
    
    
        resets.push( 
            eventWithReset(socket, 'disconnect', () => {
                log("destroy event handlers");
                this.removeListener('change', sendChange);
            })
        );
    
        log("NEW CONNECTION ns_1");    

        return () => resets.forEach((f) => f());
    }
}

export default Container;