EQ Blind Test v2 - Persistent Edition

This is a professional-grade Equalizer Blind Test application built with Electron. It allows users to compare different EQ profiles blindly and rank them using the Glicko-1 rating system.

Key Features

Seamless Switching: Switch between Profile A and B instantly without audio gaps.

Loudness Compensation: Automatically balances the perceived volume between profiles for a fair test.

Persistent Playlist: Your uploaded songs are saved in the app using IndexedDB.

Glicko-1 System: Accurate ranking based on statistical probability.

Visualizer: Real-time audio frequency visualization.

How to use

Setup: Add your EQ profiles (Equalizer APO format or JSON).

Upload: Drop your reference audio files.

Test: Click "Play A" and "Play B" to compare, then vote for your preference.

Results: Check the Ranking and League Table to see which EQ is truly the best.

For Developers

To run this locally:

Clone the repository.

Ensure you have the required libraries in the /libs folder.

Run npm install.

Run npm start.