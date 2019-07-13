import { EventEmitter } from "events";

const create = ({
    getKey = ({key}) => key,
    createContainer
} = {}) => class SeedableContainer extends EventEmitter{
    constructor(){
        super();

        this._containers = new Map();

        /* 
            key -> container, 
            value -> {
                connection: new Set()
            }
        */
        this._containersConnections = new Map();
    }
    attach(socket, confobj){
        const container = this._getContainer(confobj);

        const changeContainerProps = (change) => {
            const defaultObj = {
                connections: new Set()
            };

            const obj = this._containersConnections.has(container) ? 
                        this._containersConnections.get(container) :
                        defaultObj;

            const newObj = change(obj) || obj;
            this._containersConnections.set(container, newObj);
        }

        const destruct = container.attach(socket);

        //add the socket to the list of waiting 
        changeContainerProps((obj) => {
            obj.connections.add(socket);
        });

        return () => {
            destruct();
            changeContainerProps((obj) => {
                obj.connections.delete(socket);
            });
        }
    }
    _getContainer(obj){
        const key = getKey(obj);

        if(!this._containers.has(key)){
            this._containers.set(key, createContainer(obj));
        }

        return this._containers.get(key);
    }
}

export default create;