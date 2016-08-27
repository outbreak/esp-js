import _ from 'lodash';
import esp from 'esp-js'
import ModelBase from './modelBase';
import Story from './story';
import EventConsts from '../eventConsts';
import Colours from './colours';

let id = 0;
let idFactory = () => `epic-${id++}`;
let colourFactory = () => { return Colours.all[id%Colours.all.length]};
let epicEventPredicate = (epic, event) => epic == event.epic;

export default class Epic extends ModelBase {
    constructor(modelId, router, modal, name, itemNameDialog) {
        super(modelId, router);
        this.epicId = idFactory();
        this.name = name;
        this.stories = [];
        this.modal = modal;
        this.colours = Colours.all;
        this.colour = colourFactory();
        this.doneCount = 0;
        this.itemNameDialog = itemNameDialog;
    }

    @esp.observeEvent(EventConsts.EPIC_NAME_CHANGED, epicEventPredicate)
    _onNameChanged(event) {
        this.name = event.name;
    }

    @esp.observeEvent(EventConsts.ADD_STORY, epicEventPredicate)
    _onAddStory() {
        this.itemNameDialog.getName('Create Story', name => {
            var story = new Story(this.modelId, this.router, this, this.modal, name);
            story.observeEvents();
            this.stories.push(story);
        });
    }

    postProcess() {
        this.doneCount = _.filter(this.stories, story => story.isDone).length;
    }
}