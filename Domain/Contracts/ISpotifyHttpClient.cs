﻿using SpotSync.Domain.DTO;
using SpotSync.Domain.Errors;
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

namespace SpotSync.Domain.Contracts
{
    public interface ISpotifyHttpClient
    {
        Task<CurrentSongDTO> GetCurrentSongAsync(string partyGoerId);
        Task<string> RequestAccessAndRefreshTokenFromSpotifyAsync(string code);
        Task<ServiceResult<UpdateSongError>> UpdateSongForPartyGoerAsync(string partyGoerId, List<string> songUris, int currentSongProgressInMs);
        Task<bool> UpdateSongForPartyGoerAsync(string partyGoerId, string songUri, int currentSongProgressInMs);
        Task<List<string>> GetUserTopTrackIdsAsync(string spotifyId, int count = 10);
        Task<List<string>> GetRecommendedTrackUrisAsync(string spotifyId, List<string> seedTrackUris, float minimumEnergy = 0.0f);
        Task<List<Song>> GetRecommendedSongsAsync(string spotifyId, List<string> seedTrackIds, float minimumEnergy);
        Task<List<Song>> GetUserTopTracksAsync(string spotifyId, int limit = 10);
        Task<string> GetUsersActiveDeviceAsync(string spotifyId);
        Task<List<Song>> SearchSpotifyAsync(string spotifyId, string query);
    }
}
