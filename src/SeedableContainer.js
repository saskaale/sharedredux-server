const create = ({
    getKey = ({key}) => key,
    createContainer
} = {}) => class SeedableContainer{
    constructor(){
        this._containers = new Map();
    }
    getContainer(obj){
        const key = getKey(obj);

        if(!this._containers.has(key)){
            this._containers.set(key, createContainer(obj));
        }

        return this._containers.get(key);
    }
}

export default create;