const express = require("express");
const axios = require("axios");
const Redis = require("redis");

const redisClient = Redis.createClient({ legacyMode: true });

const DEFAULT_EXPIRATION = 3600;

const app = express();
const PORT = 3000;
app.use(express.json());

app.get("/photos", async (req, res) => {
  const albumId = req.query.albumId;

  const photos = await getOrSetCache(`photos?albumId=${albumId}`, async () => {
    const { data } = await axios.get(
      "https://jsonplaceholder.typicode.com/photos",
      { params: { albumId } }
    );

    res.json(data);
  });

  redisClient.get(`photos?albumId=${albumId}`, async (error, photos) => {
    if (error) {
      console.log("--------------- error ---------------");
      console.log(error);
    }

    if (photos != null) {
      console.log("--------------- get success ---------------");
      await redisClient.disconnect();
      return res.json(JSON.parse(photos));
    } else {
      await redisClient.connect();
      console.log("--------------- set redis ---------------");
      const { data } = await axios.get(
        "https://jsonplaceholder.typicode.com/photos",
        { params: { albumId } }
      );

      redisClient.setex(
        `photos?albumId=${albumId}`,
        DEFAULT_EXPIRATION,
        JSON.stringify(data)
      );
      res.json(data);
      // await redisClient.disconnect();
    }
  });
});

app.get("/photos/:id", async (req, res) => {
  const { data } = await axios.get(
    `https://jsonplaceholder.typicode.com/photos/${req.params.id}`
  );
  res.json(data);
});

const getOrSetCache = (key, cb) => {
  return new Promise((resolve, reject) => {
    redisClient.connect();

    redisClient.get(key, async (err, data) => {
      if (err) {
        return reject(err);
      }

      if (data != null) {
        return resolve(JSON.parse(data));
      }

      const freshData = await cb();
      redisClient.setex(key, DEFAULT_EXPIRATION, JSON.stringify(freshData));
      resolve(freshData);
    });
  });
};

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
