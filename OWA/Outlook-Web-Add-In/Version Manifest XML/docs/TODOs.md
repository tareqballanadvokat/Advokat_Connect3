# Run 
npm run lint

# Install React Dev tools


# Defining Selector Functions
ex: const posts = useAppSelector(selectPosts)
in the slices: export const selectPostById = (state: RootState, postId: string) =>
  state.posts.find(post => post.id === postId)
export const selectAllPosts = (state: RootState) => state.posts
Then in the component page: const post = useAppSelector(state => selectPostById(state, postId!))


# Install Script Lab
https://learn.microsoft.com/en-us/office/dev/add-ins/overview/set-up-your-dev-environment?tabs=yeomangenerator

# Adding an Auth Slice
https://redux.js.org/tutorials/essentials/part-4-using-data#adding-an-auth-slice
and here
https://redux.js.org/tutorials/essentials/part-6-performance-normalization#sending-login-requests-to-the-server

# Then add a component for showing the active username

# Clearing Other State on Logout
https://redux.js.org/tutorials/essentials/part-4-using-data#clearing-other-state-on-logout
Using extraReducers to Handle Other Actions: many different slice reducers can all respond to the same dispatched action, and each slice can update its own state if needed!
This is beneficial when we get disconnected, so we can update the connection state across the app

# in https://redux.js.org/tutorials/essentials/part-5-async-logic#dispatching-thunks-from-components
https://redux.js.org/tutorials/essentials/part-5-async-logic#avoiding-duplicate-fetches

you can see how to avoid fetching data on re-render
The actual logic here in the useEffect is correct. The issue is that right now we're looking at a development build of our application, and in development, React will run all useEffect hooks twice on mount when inside of its <StrictMode> component in order to make some kinds of bugs happen more obviously.


# For more details on these arguments and how to handle canceling thunks and requests, see the createAsyncThunk API reference page.

# Performance:
 // ❌ WRONG - this _always_ creates a new array reference!
  return allPosts.filter(post => post.user === userId)
  also array.slice
  https://redux.js.org/tutorials/essentials/part-6-performance-normalization#memoizing-selector-functions
  Memoizing Selector Functions
  Note that not all selectors in an application need to be memoized! The rest of the selectors we've written are still just plain functions, and those work fine. Selectors only need to be memoized if they create and return new object or array references, or if the calculation logic is "expensive".

# https://redux.js.org/tutorials/essentials/part-6-performance-normalization#options-for-optimizing-list-rendering
Options for Optimizing List Rendering
There's a few different ways we could optimize this behavior in <PostsList>.

First, we could wrap the <PostExcerpt> component in React.memo(), which will ensure that the component inside of it only re-renders if the props have actually changed. This will actually work quite well - try it out and see what happens:

# Writing Reactive Logic
However, sometimes we need to write more logic that runs in response to things that happened in the app, such as certain actions being dispatched.
We've already seen that we can have many reducers respond to the same dispatched action. That works great for logic that is just "update more parts of the state", but what if we need to write logic that is async or has other side effects? We can't put that in the reducers - reducers must be "pure" and must not have any side effects.

If we can't put this logic with side effects in reducers, where can we put it?

The answer is inside of Redux middleware, because middleware is designed to enable side effects.
https://redux.js.org/tutorials/essentials/part-6-performance-normalization#writing-reactive-logic
