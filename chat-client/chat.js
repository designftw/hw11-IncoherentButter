import * as Vue from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'
import { mixin } from "https://mavue.mavo.io/mavue.js";
import GraffitiPlugin from 'https://graffiti.garden/graffiti-js/plugins/vue/plugin.js'
import Resolver from './resolver.js'

const app = {
  // Import MaVue
  mixins: [mixin],

  // Import resolver
  created() {
    this.resolver = new Resolver(this.$gf)  
  },

  setup() {
    // Initialize the name of the channel we're chatting in
    const channel = Vue.ref('ryan') //defines reactive object channel: {value: 'default-demo'} 

    // And a flag for whether or not we're private-messaging
    const privateMessaging = Vue.ref(false) //reactive privateMessaging status

    // If we're private messaging use "me" as the channel,
    // otherwise use the channel value
    const $gf = Vue.inject('graffiti')
    const context = Vue.computed(()=> privateMessaging.value? [$gf.me] : [channel.value])//context is [$gf.me] if in PM, channel.value otw

    // Initialize the collection of messages associated with the context
    /**
     * Pull messages from graffiti by passing in the given context. Result is all the objects in that context.
     * This returns `objects`, which has all the data for the context, and `{objects: messagesRaw}` reassigns the
     * name.
     */
    const { objects: messagesRaw } = $gf.useObjects(context)
    return { channel, privateMessaging, messagesRaw }  // variables the app template will need
  },

  data() {
    // Initialize some more reactive variables
    return {
      messageText: '',
      editID: '',
      editText: '',
      replyID: '',
      replyText: '',
      recipient: '',
      recipientUsername: '',
      //Username
      requestedUsername: '',
      confirmedUsername: '',
      usernameResult: '',
      lastUsername: '',
      usernames: [],
      actorIds: [],
      myUsername: '',
      actorsToUsernames: [],
      downloadedImages: [],
      threadToColor: [],
      coloringMode: false,
      threadsToMessages: [],
      replyToThreadId: [],
      messageToIsReply: [],
      coloringThreadId: '',
      coloringThreadMessages: [],
      boilerplateColor: 'blue',
      messageThreadId: '',
      coloredStyle: '',
      
    }
  },

  provide(){
    return {
      replyToThreadId: Vue.computed(() => this.replyToThreadId),
      messageToIsReply: Vue.computed(() => this.messageToIsReply),
      actorsToUsernames: this.actorsToUsernames
      // replyToThreadId: this.replyToThreadId,
      // messageToIsReply: this.messageToIsReply
    }

  },

  watch: {
    // if the user's actor ID changes, update username
    '$gf.me': async function(me) {
      this.myUsername = await this.resolver.actorToUsername(me)
    },

    /**
     * watch for new messages or changes in old messages so that
     * all actor IDs are tracked and matched with correct usernames
     */
  
    async messages(messages) {
      for (const m of messages) {
        // actor->username maps check out
        if (!(m.actor in this.actorsToUsernames)) {
          this.actorsToUsernames[m.actor] = await this.resolver.actorToUsername(m.actor)
        }
        if (m.bto && m.bto.length && !(m.bto[0] in this.actorsToUsernames)) {
          this.actorsToUsernames[m.bto[0]] = await this.resolver.actorToUsername(m.bto[0])
        }
        // if message id not recorded in this.messageToIsReply, we mark it as not a reply ??
        if(!(m.id in this.messageToIsReply)){
          this.messageToIsReply[m.id] = (m.id in this.replyToThreadId) // IF m.id in replyToThreadId, message is reply. Otherwise, default to false (still might be a reply but not recorded in replyToThreadId)
          console.log(`app.watch.messages m.id =${m.id} not in replyToThreadId=${this.replyToThreadId}`)
        }
        const messageIsReply = this.messageToIsReply[m.id] || m.inReplyTo
        if (!messageIsReply){
          // m not a reply; its thread ID is its ID as well
          const threadId = m.id
          if (!m.threadId){
            m.threadId = threadId
          }
          console.log(`app.watch.messages not reply, thread id = ${threadId}`)

          // update threadsToMessages map (thread ID -> [message1, ..., messageN])
          if(!(m in this.threadsToMessages)){
            this.threadsToMessages[threadId] = [m]
          }

          // initialize thread color to null in threadToColor: threadId -> color
          if(!(threadId in this.threadToColor)){
            this.threadToColor[threadId] = null
            console.log(`app.watch.messages threadToColor[threadId] set to null`)
          }

        } else {
          // m is a reply
          if(!(m.id in this.replyToThreadId)){
            // if message not yet logged in replyToThreadId, log it
            try {
              // this.replyToThreadId[m.id] = this.replyToThreadId[m.inReplyTo]
              this.replyToThreadId[m.id] = m.threadId
            } catch {
              console.log(`app.watch.messages msg and msg.inReplyTo BOTH not in replyToThreadId`)
            }
          }
          const threadId = this.replyToThreadId[m.id]
          console.log(`app.watch.messages is reply, thread id = ${threadId}`)
          console.log(`app.watch.messages after ensuring reply is stored, replyToThreadId=${this.replyToThreadId}`)


          // update threadsToMessages map (threadId->[message1,...,messageN])
          if(!(m in this.threadsToMessages)){
            if (!(threadId in this.threadsToMessages)){
              // add threadId to map if it's not there yet
              console.log(`app.watch.messages threadId=${threadId} not in this.threadsToMessages yet despite being a reply\nAdded message ${m.content}`)
              this.threadsToMessages[threadId] = []
              this.threadsToMessages[threadId].push(m) 
            } else{
              // add threadId to map
              console.log(`app.watch.messages threadId=${threadId} found.\ntypeof this.threadsToMessages[threadId] = ${typeof this.threadsToMessages[threadId]}`)
              this.threadsToMessages[threadId].push(m)
              console.log(`app.watch.messages threadId=${threadId} had message ${m.content} pushed into it`)
            }
            console.log(`app.watch.messages pushed message = ${m.content} to thread ID = ${threadId}`)
          }
        }
      }
    },
    coloringMode(){
      if (this.coloringMode){
        this.coloredStyle = {
          backgroundColor: 'red',
        }
      } else{
        this.coloredStyle = ''   
      }
    },
    messageThreadId(){
      for (const m of this.messages){
        if(m.threadId == this.messageThreadId){
          this.messageToIsReply[m.id] = true
          this.coloringThreadMessages.push(m.id)
        } else{
          this.messageToIsReply[m.id] = false
        }
      }
    },

    // replyToThreadId(newReplyToThreadId, oldReplyToThreadId){
    //   console.log(`app.watch.replyToThreadId enter`)
    //   let newReplyString = ""
    //   for(const [newReply, index] of enumerate(newReplyToThreadId)){
    //     if(!(newReply in oldReplyToThreadId)){
    //       newReplyString += `(${newReply}, ${newReplyToThreadId[newReply]}) added to replyToThreadId\n`
    //     } else if(newReplyToThreadId[newReply] != oldReplyToThreadId[newReply]){
    //       newReplyString += `${newReplyToThreadId[newReply]}) replaced ${oldReplyToThreadId[newReply]} for id ${newReply} in replyToThreadId\n`
    //     }
    //   }
    //   console.log(`diff:\n${newReplyString}`)
    // }
  },
  
  computed: {
    messages() {
      // console.log (`computed:messages`);
      let messages = this.messagesRaw
        // Filter the "raw" messages for data
        // that is appropriate for our application
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
        .filter(m=>
          // Does the message have a type property?
          m.type         &&
          // Is the value of that property 'Note'?
          m.type=='Note' &&
          // Does the message have a content property?
          (m.content || m.content == '')     &&
          // Is that property a string?
          typeof m.content=='string') 
      // Do some more filtering for private messaging
      if (this.privateMessaging) {
        messages = messages.filter(m=>
          // Is the message private?
          m.bto &&
          // Is the message to exactly one person?
          m.bto.length == 1 &&
          (
            // Is the message to the recipient?
            m.bto[0] == this.recipient ||
            // Or is the message from the recipient?
            m.actor == this.recipient
          ))
      }


      return messages
        // Sort the messages with the
        // most recently created ones first
        .sort((m1, m2)=> new Date(m2.published) - new Date(m1.published))
        // Only show the 10 most recent ones
        .slice(0,10)
    },
    // filter messages for those with an attachment
    // messagesWithAttachments(){
    //   return this.messagesRaw.filter(m=>
    //     m.attachment &&
    //     m.attachment.type == 'Image' &&
    //     typeof m.attachment.magnet == 'string')
    // }
    testConditionalClasses(){
      console.log(`app.methods.testConditionalClasses and coloringmode is ${this.coloringMode}`)
      if (this.coloringMode){
        // this.boilerplateColor = 'lime'
        return {
        backgroundColor: '#a65e4e',
        color: 'black',
        }
      } else{
        // this.boilerplateColor = 'pink'
        return {      
        backgroundColor: '465D4C',
        }
      }
    },
    // messageColors(){
    //   for(const m of this.messages){
    //     if(m.threadId == this.messageThreadId){
    //       this.messageToIsReply[m.id] = true
    //       return {
    //         backgroundColor: 'purple',
    //         opacity: '0.5'
    //       }
    //       // return this.coloredStyle
    //     } else {
    //       this.messageToIsReply[m.id] = false
    //       return ""
    //     }
    //   }
    // },
  },

  methods: {
    async sendMessage() {
      // Create message object to post; content comes from v-model of the input
      const message = {
        type: 'Note',
        content: this.messageText,
      }
      // If there's an attached file, get its uri and include that
      if (this.file){
        // if there's an Image, include it
        // console.log (`begin to await for file URI`);
        this.uri = await this.$gf.media.store(this.file);
        message.attachment = {
          type: 'Image',
          magnet: this.uri
        }
        this.file = null
      }
      
    
      // The context field declares which
      // channel(s) the object is posted in
      // You can post in more than one if you want!
      // The bto field makes messages private
      if (this.privateMessaging) {
        message.bto = [this.recipient] //bto is the private recipient
        message.context = [this.$gf.me, this.recipient] // context for a PM is the PAIR of users
      } else {
        message.context = [this.channel]
      }

      // +-+-+START DEBUG+-+-+
      // console.log (`begin to $gf.post(message)`);
      // +-+-+ END! DEBUG+-+-+
      // Send!
      this.$gf.post(message); // post message to graffiti database/server/whatever

      // attempting to assign thread id after the msg has been posted and gotten its own id
      message.threadId = message.id 
      this.threadsToMessages[message.id] = [message]
      this.messageToIsReply[message.id] = false
      console.log(`app.methods.sendMessage message.threadId = ${message.threadId}`)

      this.messageText="";
      // clear the "cache"
      this.uri = ""
      this.file = ""
      // console.log (`completed $gf.post(message), cleared cache`);
    },

    /**
     * Remove message from graffiti db. Will reactively remove it from DOM because it modifies `this.messages`
     * 
     */
    removeMessage(message) {
      this.$gf.remove(message)
    },

    startEditMessage(message) {
      // Mark which message we're editing
      this.editID = message.id
      // And copy over it's existing text
      this.editText = message.content
    },

    saveEditMessage(message) {
      // Save the text (which will automatically
      // sync with the server)
      message.content = this.editText
      // And clear the edit mark
      this.editID = ''
    },

    testConditionalClasses(){
      console.log(`app.methods.testConditionalClasses and coloringmode is ${this.coloringMode}`)
      if (this.coloringMode){
        this.boilerplateColor = 'lime'
        // return {
        //   styleObject: {
        //     backgroundColor: 'lime',
        //   fontSize: 'large',   
        //   border: '#d7e2d5',
        //   borderWidth: '5px',
        // }
      } else{
        this.boilerplateColor = 'pink'
      //   return {
      //     styleObject: {
      //       backgroundColor: '465D4C',
      //       fontFamily: 'Impact, Haettenschweiler, sans-serif',  
      //     border: '#d7e2d5',
      //     borderWidth: '5px',
      //   }
      }
    },
    
    async requestUsername(){
      // console.log (`app.methods.requestUsername = ${this.requestedUsername}`)    
      try {
        this.usernameResult = await this.resolver.requestUsername(this.requestedUsername) //try to claim new username
        // console.log (`app.methods.requestUsername result = ${this.usernameResult}`)
        this.myUsername = this.requestedUsername // if claim successful, change the username
      }
      catch (e){
        // console.log (`app.methods.requestUsername error = ${e.toString()}`)
        this.usernameResult = e.toString() //otherwise, display error
        // const errorMessageNode = document.createTextNode('That username is already claimed!');
        // document.getElementById("username-form").appendChild(errorMessageNode);
      }
      // Removed the clearing of field for usability
      // this.requestedUsername = "";
    },  
    /**
     * Attempts to establish a private chat with a user
     * 
     * @param actorId the actor ID of person trying to chat with
     * @returns actorId of the person being chatted with if they exist
     */
    async chatWithUser(actorId){
      this.recipient = await this.resolver.usernameToActor(this.recipientUsernameSearch)
      this.recipientUsername = this.recipientUsernameSearch
      return actorId;
    },

    async undoUsername(){
      const undoButton = document.getElementById("username-undo-button");
      if (this.lastUsername !== ""){
        // console.log (`last username = ${this.lastUsername}`);
        this.confirmedUsername = this.lastUsername;
        this.lastUsername = "";
      } else {
        const oldBackgroundColor = undoButton.style.backgroundColor;
        undoButton.style.backgroundColor = 'Pink';
        setTimeout(function () {
          undoButton.style.backgroundColor = oldBackgroundColor;
      }, 5000);
      }
    },

    onImageAttachEvent(event){
      const file = event.target.files[0];
      this.file = file;
      // console.log (`app.methods.onImageAttachEvent file =${this.file}`)
    },

    messagePreview(message){
      console.log(`app.methods.messagePreview triggered with content ${message.content}`)
      let truncatedReplyContent = ""
      if (this.message.content.length > 25){
        truncatedReplyContent = this.message.content.slice(0, 25) + "..."
      } else{
        truncatedReplyContent = this.message.content
      }
      return truncatedReplyContent
    },

    updateReplyMessages(maps){
      const mapReplyToThread = maps.mapReplyToThread
      const mapMessageReplyStatus = maps.mapMessageReplyStatus
      console.log(`app.methods.updateReplyMessages maps = ${maps}\nmapReplyToThread=${mapReplyToThread}\nmapMessageReplyStatus=${mapMessageReplyStatus}`)
      console.log(`app.methods.updateReplyMessages triggered`)
      
      console.log(`app.methods.updateReplyMessage info: type = ${typeof mapReplyToThread}\n length=${mapReplyToThread.length}`)
      if (mapReplyToThread.length > 0){
        for (const replyid of mapReplyToThread){
          if (!(replyid in this.replyToThreadId)){
            this.replyToThreadId[replyid] = mapReplyToThread[replyid]
            console.log(`app.methods.updateReplyMessages, assigning message id ${replyid} to have thread id ${mapReplyToThread[replyid]}`)
          }
        }
      }
      if (mapMessageReplyStatus.length > 0){
        for (const messageid of mapMessageReplyStatus){
          if (!(messageid in this.messageToIsReply)){
            this.messageToIsReply[messageid] = mapMessageReplyStatus[messageid]
            console.log(`app.methods.updateReplyMessages, assigning message id ${messageid} reply status to ${mapMessageReplyStatus[messageid]}`)
          }
        }
      }
      
    },

    startColoringMode(){
      this.coloringMode = true
      this.testConditionalClasses
      console.log(`app.methods.startColoringMode this.coloringMode = ${this.coloringMode}`)
    },

    stopColoringMode(){
      this.coloringMode = false
    },

    threadColorComputing(message){
      // if match, return the active color styling
      if ( message.threadId == this.coloringThreadId){
        if (message.threadId != message.id && !(message.id in this.replyToThreadId)){
          this.replyToThreadId[message.id] = message.threadId
        }
        return this.coloredStyle
      }

    },

    /**
     * Color the thread of a clicked message.
     * 
     */
    colorMessageThread(message, index){
      // get message's thread ancestor
      // for all messages with the same thread ancestor, apply CSS styling
      // step 1: apply CSS styling to single message
      // step 2: extract thread ID
      // step 3: apply CSS to all msgs with same thread ID

      console.log(`app.methods.colorMessageThread clicked msg with content = ${message.content}`)
      // potential way to access element by in v-for loop: use `this.$refs['message-ref-'+message.id]` in VueJS,
      // and put `:ref="'message-ref-'+message.id"` after the `:key` in the v-for element declaration
      console.log(`app.methods.colorMessageThread ref[messagelist][${index}] = ${this.$refs['messagelist'][index]}`)
      const currentColoringMode = this.coloringMode // set constant version so we dont lose changes when coloringMode is turned off
      
      if (currentColoringMode){
        // 1.1 change message's color property
        if (message.threadId != undefined){
          this.coloringThreadId = message.threadId
          this.messageThreadId = message.threadId
        }
        
        this.threadToColor[message.threadId] = '#fa9d5f'
        this.coloringThreadMessages.push(message.id)
        message.color = "#fa9d5f"
        // for (const threadAncestor of this.messages){
        //   // this.threadColorComputing(threadAncestor)
        //   console.log(`app.methods.colorMessageThread ancestor threadId = ${threadAncestor.threadId}, \nmessage thread ID = ${message.threadId}`)
        //   if (threadAncestor.threadId == message.threadId){
        //     console.log(`app.methods.colorThreadAncestors thread IDs match`)
        //     this.coloringThreadMessages.push(threadAncestor.id)
        //     threadAncestor.color = "red"
        //     let secondaryIndex = 0
        //     for(const secondaryMessage of this.messages){
        //       const secondaryElement = this.$refs['messagelist'][secondaryIndex]
        //       if(secondaryElement.querySelector('.thread-coloring')){
        //         console.log(`app.methods.colorMessageThread secondaryElement matches!`)
        //         const messageContainerDom = this.$refs['messagelist'][secondaryIndex]
        //         const messageContentDom = messageContainerDom.querySelector('.messageContent')
        //         messageContentDom.style.backgroundColor = 'red'
        //         messageContentDom.style.opacity = 0.5 
        //       }
        //       secondaryIndex ++
        //     }
        //     // const messageContainerDom = this.$refs['messagelist'][ancestorIndex]
        //     // const messageContentDom = messageContainerDom.querySelector('.messageContent')
        //     // messageContentDom.style.backgroundColor = 'red'
        //     // messageContentDom.style.opacity = 0.5
        //   }
        // }
        // 1.2 have message update on change to color property to change its CSS
        const messageContainerDom = this.$refs['messagelist'][index]
        const messageContentDom = messageContainerDom.querySelector('.messageContent')
        messageContentDom.style.backgroundColor = '#fa9d5f'
        // messageContentDom.style.opacity = 0.5 

        // this.colorThreadAncestors(message)
        // const threadAncestors = this.colorThreadAncestors(message)
        // console.log(`app.methods.colorMessageThread threadAncestors = ${threadAncestors}`)
        // for (const threadMsg of threadAncestors){
        //   const messageContainerDom = this.$refs['messagelist'][index]
        //   const messageContentDom = messageContainerDom.querySelector('.messageContent')
        //   messageContentDom.style.backgroundColor = 'red'
        //   messageContentDom.style.opacity = 0.5 
        // }
      }
      
      this.stopColoringMode()
    },

    colorThreadAncestors(message){
      console.log(`app.methods.colorThreadAncestors enter`)
      for (const threadAncestor of this.messages){
        console.log(`app.methods.colorMessageThread ancestor threadId = ${threadAncestor.threadId}, \nmessage thread ID = ${message.threadId}`)
        if (threadAncestor.threadId == message.threadId){
          console.log(`app.methods.colorThreadAncestors thread IDs match`)
          // const messageContainerDom = this.$refs['messagelist'][ancestorIndex]
          // const messageContentDom = messageContainerDom.querySelector('.messageContent')
          // messageContentDom.style.backgroundColor = 'red'
          // messageContentDom.style.opacity = 0.5
        }
      }
    }
  }
}
// Name handles display names, *not* usernames
const Name = {
  props: ['actor', 'editable'],

  // setup is called before the component is even created.
  // reactive variables like props, computed, data, etc. can be accessed only with 
  // Vue.toRefs() part
  // props, computed, data are all made before setup (?? maybe), but not initialized with values yet.
  // setup is "last chance" to define a reactive component b4 the component is created
  // look up "Composables" for more info
  setup(props) {
    // Get a collection of all objects associated with the actor
    // console.log (`Name.setup enter`)
    const { actor } = Vue.toRefs(props) // wrap the props into one reactive property called actor
    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor]) // result of thing being returned can be called with this.objects since it isn't renamed like in app component
  },

  computed: {
    profile() {
      // console.log (`Name.computed.profile enter`)
      return this.objects
        // Filter the raw objects for profile data
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-profile
        .filter(m=>
          // Does the message have a type property?
          m.type &&
          // Is the value of that property 'Profile'?
          m.type=='Profile' &&
          // Does the message have a name property?
          m.name &&
          // Is that property a string?
          typeof m.name=='string')
        // Choose the most recent one or null if none exists
        .reduce((prev, curr)=> !prev || curr.published > prev.published? curr : prev, null)
    }
  },

  data() {
    // console.log (`name.data enter`)
    return {
      editing: false,
      editText: ''
    }
  },

  methods: {
    editName() {
      // console.log (`Name.methods.editName enter`)
      this.editing = true
      // If we already have a profile,
      // initialize the edit text to our existing name
      this.editText = this.profile? this.profile.name : this.editText
    },

    saveName() {
      // console.log (`Name.methods.saveName enter`)
      if (this.profile) {
        // If we already have a profile, just change the name
        // (this will sync automatically)
        this.profile.name = this.editText
      } else {
        // Otherwise create a profile
        this.$gf.post({
          type: 'Profile',
          name: this.editText
        })
      }

      // Exit the editing state
      this.editing = false
    },

  },

  template: '#name'
}

const Like = {
  props: ["messageid"],

  setup(props) {
    // console.log (`Like.setup enter`)
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    // console.log (`Like.setup messageid=${messageid}`)
    const { objects: likesRaw } = $gf.useObjects([messageid])
    return { likesRaw }
  }, 


  computed: {
    // return all likes on this specific message's component
    likes() {
      // console.log (`Like.computed.likes enter`)
      return this.likesRaw.filter(l=>
        l.type == 'Like' &&
        l.object == this.messageid)
    },

    // return number of likes from unique actors on this component
    numLikes() { 
      // Unique number of actors
      // console.log (`Like.computed.numLikes enter`)
      return [...new Set(this.likes.map(l=>l.actor))].length
    },

    // return number of likes from individual user
    myLikes() {
      // console.log (`Like.computed.myLikes enter`)
      return this.likes.filter(l=> l.actor == this.$gf.me)
    }
  },

  methods: {
    toggleLike() {
      // console.log (`Like.methods.toggleLike enter`)
      if (this.myLikes.length) {
        this.$gf.remove(...this.myLikes)
      } else {
        this.$gf.post({
          type: 'Like',
          object: this.messageid,
          context: [this.messageid]
        })
      }
    }
  },

  template: '#like'
}

const Read = {
  props: ["messageid", "recipient"],

  // setup(props) {
  //   // console.log (`Read.setup enter`)
  //   const messageContext = Vue.reactive([])
  //   const $gf = Vue.inject('graffiti')
  //   const messageid = Vue.toRef(props, 'messageid')
  //   const recipient = Vue.toRef(props, 'recipient')
  //   const viewer = Vue.toRef(props, 'viewer')
  //   if(props.recipient == $gf.me){
  //     // console.log (`Read.methods.toggleRead recipient is viewer`)
  //     const readObj = {
  //       type: 'Read',
  //       object: props.messageid,
  //       context: [props.messageid],
  //     }
  //     $gf.post(readObj)useread
  //     messageContext.push(readObj)
  //   }
  //   // console.log (`Read.setup messageid=${props.messageid}\nrecipient=${JSON.stringify(props.recipient)}\nviewier=${props.viewer}, gf.me=${$gf.me}`)
  //   // const { objects: readsRaw } = $gf.useObjects([messageid])
  //   const { objects: message } = $gf.useObjects([messageid])
  //   const { read } = $gf.useRead(message, props.recipient)
  //   return { read }
  // }, 
  setup(props) {
    // console.log (`Read.setup enter`)
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const recipient = Vue.toRef(props, 'recipient')

    // console.log (`Read.setup messageid=${props.messageid}`)
    // console.log (`Read.setup recipient=${props.recipient}`)
    // console.log (`Read.-------------`)

    const { objects: readsRaw } = $gf.useObjects([messageid])
    return { readsRaw }
  }, 


  async mounted() {
    // post a read notif if the current user isn't in the list of actors
    if (!(this.readActors.includes(this.$gf.me))) {
      // console.log (`Read.mounted msg has been read by ${this.$gf.me}!`)
      this.$gf.post({
        type: 'Read',
        object: this.messageid,
        context: [this.messageid]
      })
    }
  },

  data() {
    return {
      readByRecipient: false,
    }
  },

  computed: {
    // return all reads on this specific message's component
    reads() {
      // console.log (`Read.computed.reads enter`)
      // console.log (`Read.computed.reads this.recip=${this.recipient}`)
      // console.log (`Read.computed.reads message content = ${this.message.content}`)
      // console.log (`Read.-------------`)
      return this.readsRaw.filter(r=>
        r.type == 'Read' &&
        r.object == this.messageid)
    },

    myReads() {
      return this.reads.filter(r=>{
        r.actor==this.$gf.me
      })
    },

    readActors(){
      return [...new Set(this.reads.map(r=>r.actor))]
    },

    readActorsSet(){
      
      this.reads.filter(r=>{
        if(r.actor == this.recipient){
          this.readByRecipient = true
        }
      })
      return this.readByRecipient

      // let recipientHasRead = false;
      // this.reads.map(r => {
      //   // console.log (`Read.computed.readActorsSet r.actor = ${r.actor}`)
      //   if (r.actor == this.recipient){
      //     // console.log (`Read.computed.readActorsSet MATCH FOUND`)
      //     recipientHasRead = true;
      //     return true
      //   }
      // })
      // if (!recipientHasRead){
      //   return false
      // }
      // return new Set(this.reads.map(r=>r.actor))
    },

    // // return number of reads from unique actors on this component
    numReads() { 
      // Unique number of actors
      // console.log (`Read.computed.numReads enter`)
      // console.log (`Read.computed.numReads gf.me = ${this.$gf.me}`)
      for (const r of this.reads){
        // console.log (`Read.computed.numReads actor = ${r.actor}`)
        if (r.read || r.actor == this.$gf.me){
          // console.log (`Read.-------------`)
          // console.log (`Read.computed.numReads RETURNING 1`)
          return 1
        }
      }
      // console.log (`Read.computed.numReads RETURNING 0`)
      // console.log (`Read.-------------`)
      return 0
    }
  },
  
  watch: {
    // In case we accidentally "read" more than once.
    myReads(myReads){
      if (myReads.length > 1){
        // Remove all but one
        this.$gf.remove(...myReads.slice(1))
      }
    }
  },
  
  template: '#read'
}

const Reply = {
  props: ["message"],
  inject: ["replyToThreadId", "messageToIsReply", "actorsToUsernames"],

  created() {
    this.resolver = new Resolver(this.$gf)
  },

  data(){
    return {
      replyID: '',
      replyText: '',
      // replyToThreadId: this.replyToThreadId,
      // messageToIsReply: this.messageToIsReply
    }
  },

  setup(props) {
    // console.log (`Reply.setup enter`)
    const $gf = Vue.inject('graffiti')
    const message = Vue.toRef(props, 'message')
    const messageid = props.message.id
    // console.log (`Reply.setup messageid=${props.message.messageid}`)
    const messageUsername = `Reply.setup actor=${props.message.actor}`
    const { objects: repliesRaw } = $gf.useObjects([message])
    const channel = Vue.ref('ryan')
    return { channel, repliesRaw }
  }, 

  computed: {
    // return all likes on this specific message's component
    replies() {
      // console.log (`Like.computed.likes enter`)
      return this.repliesRaw.filter(r=>
        r.type == 'Note' &&
        r.object == this.messageid)
    },
  },

  methods: {
    startReplyMessage(){
      // mark the message being replied to
      this.replyID = this.message.id;
      // this.replyText = "";

      // clear the "cache"
    },
    async sendReplyMessage(){
      // generate preview of respondee content
      let truncatedReplyContent = ""
      if (this.message.content.length > 25){
        truncatedReplyContent = this.message.content.slice(0, 25) + "..."
      } else{
        truncatedReplyContent = this.message.content
      }
      
      // construct replyMessage object
      const messageUsername = await this.resolver.actorToUsername(this.message.actor)
      // const replyMessage = {
      //   type: 'Note',
      //   content: this.replyText,
      //   inReplyTo: this.message.id, 
      //   respondeeContentPreview: truncatedReplyContent,
      //   userRepliedTo: messageUsername,
      //   // threadId: this.message.id,
      //   // isReply: true,
      //   context: [this.message.id]
      // }
      const replyMessage = {
        type: 'Note',
        content: this.replyText,
        inReplyTo: this.message.id, 
        respondeeContentPreview: truncatedReplyContent,
        userRepliedTo: messageUsername,
        context: [this.message.id],
        threadId: null
      }
      console.log(`Reply.methods.sendReplyMessage replyMessage = `, replyMessage)


      if (this.privateMessaging) {
        replyMessage.bto = [this.recipient]
        replyMessage.context = [this.$gf.me, this.recipient]
      } else {
        replyMessage.context = [this.channel]
      }

      const respondeeIsReply = this.messageToIsReply[this.message.id]
      //map reply ID to the thread ID
      if (respondeeIsReply){
        // thread ID must be found via our dictionary
        this.replyToThreadId[replyMessage.id] = this.replyToThreadId[this.message.id]
        replyMessage.threadId = this.message.threadId
      } else {
        // thread ID is just the ID of message we reply to
        this.replyToThreadId[replyMessage.id] = this.message.id 
        replyMessage.threadId = this.message.id
      }
      this.messageToIsReply[replyMessage.id] = true // mark message as a reply


      this.$gf.post(replyMessage)     


      this.$emit(`replymessageupdate`, {
        mapReplyToThread: this.replyToThreadId,
        mapMessageReplyStatus: this.messageToIsReply
      })

      console.log(`Reply.methods.sendReplyMessage emitted replymessageupdate`)



      this.replyText="";
      this.replyID = '';
    },
  },

  template: '#reply'
}

const MagnetImg = {
  props: {
    src: String,
    loading: {
      type: String,
      default: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Loading_icon_cropped.gif'
    },
    error: {
      type: String,
      default: '' // empty string will trigger broken link
    }
  },

  data() {
    return {
      fetchedSrc: ''
    }
  },

  watch: {
    src: {
      async handler(src) {
        this.fetchedSrc = this.loading
        try {
          this.fetchedSrc = await this.$gf.media.fetchURL(src)
        } catch {
          this.fetchedSrc = this.error
        }
      },
      immediate: true
    }
  },

  template: '#magnet-img'
}

const Prof = {
  props: {
    actor: {
      type: String
    },
    editable: {
      type: Boolean,
      default: false
    },
    anonymous: {
      type: String,
      default: 'magnet:?xt=urn:btih:58c03e56171ecbe97f865ae9327c79ab3c1d5f16&dn=Anonymous.svg&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com'
    }
  },

  setup(props) {
    // Get a collection of all objects associated with the actor
    // console.log (`Prof.setup enter`)
    const { actor } = Vue.toRefs(props)
    // console.log (`Prof.setup actor=${props.actor}`)

    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor])
  },

  data() {
    // console.log (`Prof.data enter`)
    return {
      editing: false,
      editText: '',
      profile: '',
      profilelink: '',
      profileMagnet: '',
      downloadProfilePics: [], //uri to blob
      actorToProfilePics: [], //actor id to blob
      uri: ''
    }
  },
  computed: {
    // messagesWithAttachments(){
    //   return this.messages.filter(m=>
    //     m.attachment &&
    //     m.attachment.type == 'Image' &&
    //     typeof m.attachment.magnet == 'string')
    // },
    async profilePics(){
      // console.log (`Prof.computed.profilePics enter`)

      this.uri = await this.$gf.media.store(this.profilelink)
      // console.log (`Prof.computed.profilePics uri=${this.uri}`)

      //blob start
      let blob;
      try {
        blob = await this.$gf.media.fetch(this.uri);
        // console.log (`Prof.computed.profilePics try blob=${blob}`)
      } catch {
        this.downloadProfilePics[this.uri] = false;
        // console.log (`Prof.computed.profilePics catch`)
      }
      const urlBlob =  URL.createObjectURL(blob)
      this.downloadProfilePics[this.uri] = urlBlob
      this.actorToProfilePics[this.actor] = urlBlob
      // console.log (`Prof.computed.profilePics blob=${blob}`)
      return this.messages.filter(m=>
        m.attachment &&
        m.attachment.type == 'Image' &&
        typeof m.attachment.magnet == 'string')
    }, 

  },
  watch:{
    async saveProfilePic(){
      // console.log (`Prof.watch.saveProfilePic enter`)
      if (!(this.actor in this.actorToProfilePics)) {
        // if magnet not in cache, try adding it
        let blob;
        try {
          blob = await this.$gf.media.fetch(this.uri);
          // console.log (`Prof.watch.saveProfilePic if,try with uri=${this.uri}`)
        } catch {
          this.downloadProfilePics[this.uri] = false;
          // console.log (`Prof.watch.saveProfilePic if,catch`)
        }
        const urlBlob =  URL.createObjectURL(blob)
        this.downloadProfilePics[this.uri] = urlBlob
        this.actorToProfilePics[this.actor] = urlBlob
        // console.log (`Prof.watch.saveProfilePic if, storing ${this.downloadProfilePics[this.uri]}`)

      } else{
        // console.log (`Prof.watch.saveProfilePic else branch`)
      }
      
    }
  },

  methods: {
    editProfilePic() {
      // console.log (`Prof.methods.editProfilePic enter`)
      this.editing = true
      // If we already have a profile,
      // initialize the edit profile link to our existing ProfilePic link
      this.editPfp = this.profile? this.profile : this.editPfp
      // console.log (`Prof.methods.editProfilePic this.editPfp=${this.editPfp}`)
    },
    async saveProfilePic() {
      // console.log (`Prof.methods.saveProfilePic enter`)
      if (this.profilelink) {
        // If we already have a profile, just change the ProfilePic
        // (this will sync automatically)
        this.uri = await this.$gf.media.store(this.profilelink)

        //blob start
        let blob;
        try {
          blob = await this.$gf.media.fetch(this.uri);
          // console.log (`Prof.methods.saveProfilePic if,try with uri=${this.uri}`)
        } catch {
          this.downloadProfilePics[this.uri] = false;
          // console.log (`Prof.methods.saveProfilePic if,catch`)
        }
        const urlBlob =  URL.createObjectURL(blob)
        this.downloadProfilePics[this.uri] = urlBlob
        this.actorToProfilePics[this.actor] = urlBlob
        // console.log (`Prof.methods.saveProfilePic if, storing ${this.downloadProfilePics[this.uri]}`)
        //blob end


        // console.log (`Prof.methods.saveProfilePic uri=${this.uri}`)

        const profileObj = {
          type: 'Profile',
          icon: {
            type: 'Image',
            magnet: [this.uri]
          }
        }
        this.profile = profileObj
        this.profile.icon.magnet = this.uri
        // console.log (`Prof.methods.saveProfilePic uri = ${this.uri}`)
        this.$gf.post(profileObj)
      }
      // Exit the editing state
      this.editing = false
    },

    onProfilePicAttachEvent(event){
      this.editing = true
      // If we already have a profile,
      // initialize the edit profile link to our existing ProfilePic link
      this.editPfp = this.profile? this.profile : this.editPfp
      // console.log (`Prof.methods.onProfilePicAttachEvent this.editPfp=${this.editPfp}`)

      const profilelink = event.target.files[0];
      // console.log (`Prof.methods.onProfilePicAttachEvent profilepic=${profilelink}`)
      this.profilelink = profilelink;
    },
    async profileAttachmentUpload(){
      if (this.profilelink){
        this.uri = await this.$gf.media.store(this.profilelink)
        // console.log (`Prof.methods.profileAttachmentUpload uri=${this.uri}`)
      } else{
        // console.log (`Prof.methods.profileAttachmentUpload NO PROFILELINK`)
      }
    }
  },


  template: '#prof'
}

const ColorManager = {
  props: ["color", "private-messaging", "channel"],

  setup(props) {
    const privateMessaging = Vue.toRef(props, 'private-messaging')
    const channel = Vue.toRef(props, 'channel')

    // If we're private messaging use "me" as the channel,
    // otherwise use the channel value
    const $gf = Vue.inject('graffiti')
    const context = Vue.computed(()=> privateMessaging? [$gf.me] : [channel.value])

    // Initialize the collection of messages associated with the context
    const { objects: messagesRaw } = $gf.useObjects(context)
    return { messagesRaw }
  },

  data(){
    return{
      paintbrushColor: 'blue',
      blueStyle: {
        color: 'blue'
      },
      colorToThread: [],
      threadToColor: []
    }
  },

  computed: {
    messages() {
      // console.log (`computed:messages`);
      let messages = this.messagesRaw
        // Filter the "raw" messages for data
        // that is appropriate for our application
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
        .filter(m=>
          // Does the message have a type property?
          m.type         &&
          // Is the value of that property 'Note'?
          m.type=='Note' &&
          // Does the message have a content property?
          (m.content || m.attachment || m.content == '')     &&
          // Is that property a string?
          typeof m.content=='string') 
      // Do some more filtering for private messaging
      if (this.privateMessaging) {
        messages = messages.filter(m=>
          // Is the message private?
          m.bto &&
          // Is the message to exactly one person?
          m.bto.length == 1 &&
          (
            // Is the message to the recipient?
            m.bto[0] == this.recipient ||
            // Or is the message from the recipient?
            m.actor == this.recipient
          ))
      }


      return messages
        // Sort the messages with the
        // most recently created ones first
        .sort((m1, m2)=> new Date(m2.published) - new Date(m1.published))
        // Only show the 10 most recent ones
        .slice(0,10)
    },
    cursorRed(){
      return `cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'  width='40' height='48' viewport='0 0 100 100' style='fill:black;font-size:24px;'><text y='50%'>🟥</text></svg>") 16 0,auto; !emojicursor.app`
    }
  },

  methods: {
    beginAssignColor() {
      this.paintbrushColor = this.color
      this.$emit('colorbeginevent')
      console.log (`Colormanager.methods.beginAssignColor`)
    },

    assignColor(){
      //get message's thread ID
      //filter all messages, if thread ID matches the clicked msg's thread ID then apply color
      console.log(`ColorManager.methods.assignColor event emitted`)
    }
  },

  template: '#color-manager'
}


app.components = { Name, Like, Read, Reply, Prof, ColorManager}
Vue.createApp(app)
  .component('magnet-img', MagnetImg)
  .component('color-manager', ColorManager)
  .use(GraffitiPlugin(Vue))
  .mount('#app')
