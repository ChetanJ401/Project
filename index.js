const cluster = require('cluster'); //NodeJs inbuilt module "cluster" It helps to create child worker process. Each worker being separate instance of application
const numCPUs = require('os').cpus().length; //It checks how many CPUs are available to set up worker process
const express = require('express');
const http = require('http');
const PORT = 4000;

// Processing the master
if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Added a check for fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    // Make sure that a new worker is created if one stops working.
    cluster.fork();
  });

  // Implementing Load balancer
  const loadBalancer = express();
  loadBalancer.use(express.json());

  // Redirecting the requests to worker instances
  loadBalancer.all('/api/*', (req, res) => {
    const worker = Object.values(cluster.workers)[0];
    worker.send(req);
    worker.on('message', (msg) => {
      res.json(msg);
    });
  });

  // Start the load balancer on port 4000
  http.createServer(loadBalancer).listen(PORT, () => {
    console.log(`Load balancer running on port ${PORT}`);
  });
} else {
  // Worker processes triggered
  const app = express();

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Authorization credentials for access
  const myAuth = {
    username: 'baxture',
    password: 'ensuresers123'
  };

  // Basic authorization middleware to be used
  const basicAuthorizationMechanism = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header is missing' });
    }
    const authData = authHeader.split(' ')[1];
    const credentials = Buffer.from(authData, 'base64').toString('utf-8').split(':');
    const username = credentials[0];
    const password = credentials[1];
    if (username !== myAuth.username || password !== myAuth.password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    next();
  };

  // Creating an users array to accommodate the dummy data
  let users = [
    { id: '1', username: 'Alex', age: 25, hobbies: "Reading,Acting" },
    { id: '2', username: 'Henry', age: 30, hobbies: "Writing,Gardening" }
  ];

  // Api call to get the data for all users
  app.get('/api/users', basicAuthorizationMechanism, (req, res) => {
    res.json({data:users,message:"Data received successfully"});
  });

  // Api call to get the data of specific user
  app.get('/api/users/:userId', basicAuthorizationMechanism, (req, res) => {
    const { userId } = req.params;
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({data:user,message:"Data received successfully"});
  });

  // Api call to create a new user
  app.post('/api/users', basicAuthorizationMechanism, (req, res) => {
    const { username, age, hobbies } = req.body;
    const id = (users.length + 1).toString();
    const newUser = { id, username, age, hobbies };
    users.push(newUser);
    res.status(200).json({data:newUser,message:"User Created Successfully"});
  });

  // Api call to update an existing user
  app.put('/api/users/:userId', basicAuthorizationMechanism, (req, res) => {
    const { userId } = req.params;
    const { username, age,hobbies } = req.body;
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    users[index].username = username;
    users[index].age = age;
    users[index].hobbies = hobbies;
    res.json({data:users[index],message:"User updated successfully"});
  });

  // Api call to delete a user
  app.delete('/api/users/:userId', basicAuthorizationMechanism, (req, res) => {
    const { userId } = req.params;
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    users.splice(index, 1);
    res.json({ message: "Record deleted successfully" });
  });

  // Start the worker on a unique port based on the worker ID
  const workerPort = PORT + cluster.worker.id;
  app.listen(workerPort, () => {
    console.log(`Worker ${cluster.worker.id} running on port ${workerPort}`);
  });

  // Listen for requests from the load balancer
  process.on('message', (req) => {
    app(req, {}, (err) => {
      process.send(err || req);
    });
  });
}
