import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    doc,
    setDoc,
    getDocs,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCDse1EY3HCAo5nLOFErEpOi5j3_-K1RTE",
    authDomain: "social-network-b0619.firebaseapp.com",
    projectId: "social-network-b0619",
    storageBucket: "social-network-b0619.firebasestorage.app",
    messagingSenderId: "868066934438",
    appId: "1:868066934438:web:65e53342a862a6b8d63e67",
    measurementId: "G-MBC24SRCVM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

// References to HTML elements
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const authSection = document.getElementById("auth-section");
const chatSection = document.getElementById("chat-section");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const messagesDiv = document.getElementById("messages");
const currentChatUser = document.getElementById("current-chat-user");
const signupBtn = document.getElementById("signup-btn");
const signupSubmitBtn = document.getElementById("signup-submit-btn");
const backToLoginBtn = document.getElementById("back-to-login-btn");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const userSearchInput = document.getElementById("user-search-input");
const userSearchResults = document.getElementById("user-search-results");
const profileBtn = document.getElementById("profile-btn");
const profileModal = document.getElementById("profile-modal");
const modalUsername = document.getElementById("modal-username");
const modalEmail = document.getElementById("modal-email");

// Global variables
const usersCollection = collection(db, "users");
let currentConversationId = null;
const unreadMessages = {};

// Check if the user is already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        toggleSection(true);
        // Force refresh of chat interface
        updateSearchResults(); // This will re-populate the user list
        if (currentConversationId) {
            // If a conversation was active
            listenForPrivateMessages(currentConversationId); // Re-attach the message listener
        }
    } else {
        // If not logged in, ensure the auth section is displayed
        toggleSection(false);
    }
});

// Event listener for login button
loginBtn.addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            toggleSection(true);
        })
        .catch((err) => alert(err.message));
});

// Event listener for signup button
signupBtn.addEventListener("click", () => {
    loginForm.style.display = "none";
    signupForm.style.display = "block";
});

// Event listener for back to login button
backToLoginBtn.addEventListener("click", () => {
    signupForm.style.display = "none";
    loginForm.style.display = "block";
});

// Event listener for signup submit button
signupSubmitBtn.addEventListener("click", () => {
    const email = document.getElementById("email-signup").value;
    const password = document.getElementById("password-signup").value;
    const username = document.getElementById("username-signup").value.trim();

    if (!username) {
        alert("Please choose a username.");
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;

            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {username: username});

            // Update displayName in Firebase Authentication
            await user.updateProfile({displayName: username});

            signInWithEmailAndPassword(auth, email, password)
                .then(() => {

                    toggleSection(true);
                })
                .catch((err) => alert(err.message));
        })
        .catch((err) => alert(err.message));
});

// Event listener for logout button
logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
        // Redirect to a new page or clear local storage if necessary
        window.location.href = "index.html";
    });
});

// Function to toggle between auth and chat sections
function toggleSection(loggedIn) {
    if (loggedIn) {
        authSection.style.display = "none";
        chatSection.style.display = "block";
    } else {
        authSection.style.display = "block";
        chatSection.style.display = "none";
    }
}

// Event listener for user search input
userSearchInput.addEventListener("input", async () => {
    updateSearchResults();
    userSearchResults.style.display = "block"; // Show the search results when typing
});

// Function to start a private chat with a user
async function startPrivateChat(userId, username) {
    userSearchResults.style.display = "none";
    const user1 = auth.currentUser.uid;
    const user2 = userId;

    const conversationId =
        user1 < user2 ?
            `${user1}-${user2}` : `${user2}-${user1}`;
    currentConversationId = conversationId;

    currentChatUser.textContent = `Chatting with: ${username}`;
    // Clear unread messages for this conversation
    unreadMessages[conversationId] = 0;
    // Update the search results to remove the notification dot
    updateSearchResults();
    const messagesCollection = collection(
        db,
        "conversations",
        conversationId,
        "messages"
    );
    listenForPrivateMessages(conversationId);
    sendBtn.onclick = async () => {
        const messageText = messageInput.value;
        if (messageText.trim() === "") return;
        messageInput.value = "";
        try {
            await addDoc(messagesCollection, {
                sender: auth.currentUser.uid,
                text: messageText,
                timestamp: new Date(),
            });
        } catch (err) {
            alert("Error sending message: ", err);
        }
    };
}

// Function to listen for new messages in a conversation
function listenForPrivateMessages(conversationId) {
    const messagesCollection = collection(
        db,
        "conversations",
        conversationId,
        "messages"
    );
    const q = query(messagesCollection, orderBy("timestamp"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const messageData = change.doc.data();
                const sender = messageData.sender;

                // Check if the message is from the other user
                if (sender !== auth.currentUser.uid) {
                    // Increment unread count for this conversation
                    unreadMessages[conversationId] =
                        (unreadMessages[conversationId] || 0) + 1;

                    // Update the search results to show the notification dot
                    updateSearchResults();
                }

                appendMessage(
                    messageData.text,
                    sender === auth.currentUser.uid ? "you" : "them",
                    messageData.timestamp
                );
            }
        });
    });
}

// Function to append a new message to the chat
function appendMessage(text, sender, timestamp) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);

    // Get the current user's username
    let currentUsername = "You";
    if (auth.currentUser && auth.currentUser.displayName) {
        currentUsername = auth.currentUser.displayName;
    }

    // Display the username based on the sender
    const username =
        sender === "you"
            ? currentUsername
            : currentChatUser.textContent.replace("Chatting with: ", "");
    // Format timestamp to a readable format
    const formattedTimestamp = new Date(
        timestamp.seconds * 1000
    ).toLocaleString();
    // Add the username and timestamp to the message
    messageDiv.innerHTML = `
          <p class="message-text"><span class="username">${username}:</span> ${text}</p>
          <span class="message-timestamp">${formattedTimestamp}</span>
      `;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Function to update the search results
async function updateSearchResults() {
    const searchTerm = userSearchInput.value.trim().toLowerCase();
    userSearchResults.innerHTML = ""; // Clear previous results

    if (searchTerm) {
        try {
            // Fetch all users
            const allUsersSnapshot = await getDocs(usersCollection);
            const existingUsernames = new Set();

            // Store usernames in a Set for efficient lookup
            allUsersSnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData.username) {
                    existingUsernames.add(userData.username.toLowerCase());
                }
            });
            // Filter users based on the search term and check if they exist
            const filteredUsers = allUsersSnapshot.docs.filter((doc) => {
                const username = doc.data().username;
                const userId = doc.id;
                return (
                    username && // Check if the username exists
                    username.toLowerCase().includes(searchTerm) &&
                    userId !== auth.currentUser.uid &&
                    existingUsernames.has(username.toLowerCase()) &&
                    username !== "ExampleUser"
                );
            });
            // Display the filtered users
            filteredUsers.forEach((doc) => {
                const username = doc.data().username;
                const userId = doc.id;
                const userItem = document.createElement("li");
                userItem.textContent = username;

                // Add notification dot if there are unread messages
                if (unreadMessages[userId] > 0) {
                    const notificationDot = document.createElement("span");
                    notificationDot.classList.add("notification-dot");
                    userItem.appendChild(notificationDot);
                }

                userItem.addEventListener("click", () =>
                    startPrivateChat(userId, username)
                );
                userSearchResults.appendChild(userItem);
            });
        } catch (error) {
            console.error("Error updating search results:", error);
        }
    }
}

// Event listener for profile button
profileBtn.addEventListener("click", async () => {

    // Toggle the display of the profile modal
    if (profileModal.style.display === "block") {
        profileModal.style.display = "none";
    } else {
        profileModal.style.display = "block";

        const user = auth.currentUser;
        if (user) {
            // Fetch username from Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            modalUsername.textContent = userDoc.data().username || "N/A";

            modalEmail.textContent = user.email;
        } else {
            modalUsername.textContent = "N/A";
            modalEmail.textContent = "N/A";
        }
    }
});

window.closeProfileModal = function () {
    const profileModal = document.getElementById("profile-modal");
    profileModal.style.display = "none";
};
