﻿using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SpotSync.Application.Authentication;
using SpotSync.Domain;
using SpotSync.Domain.Contracts;
using SpotSync.Domain.DTO;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace SpotSync.Infrastructure
{
    public class SpotifyHttpClient : ISpotifyHttpClient
    {
        private HttpClient _httpClient;
        private SpotifyAuthentication _spotifyAuthentication;

        public SpotifyHttpClient(string clientId, string clientSecret, string redirectUrl)
        {
            _httpClient = new HttpClient();
            _spotifyAuthentication = new SpotifyAuthentication(clientId, clientSecret, redirectUrl);
        }

        public async Task<string> RequestAccessAndRefreshTokenFromSpotifyAsync(string code)
        {
            string apiEndpoint = "https://accounts.spotify.com/api/token";

            List<KeyValuePair<string, string>> properties = new List<KeyValuePair<string, string>> {
                new KeyValuePair<string, string>("grant_type", "authorization_code"),
                new KeyValuePair<string, string>("code", code),
                new KeyValuePair<string, string>("redirect_uri", _spotifyAuthentication.RedirectUrl),
                new KeyValuePair<string, string>("client_id", _spotifyAuthentication.ClientId),
                new KeyValuePair<string, string>("client_secret", _spotifyAuthentication.ClientSecret)
            };

            HttpResponseMessage response = null;

            using (var requestMessage = new HttpRequestMessage(HttpMethod.Post, apiEndpoint))
            {
                requestMessage.Content = new FormUrlEncodedContent(properties);

                response = await _httpClient.SendAsync(requestMessage);
            }

            if (response is null)
            {
                throw new Exception("The response from requesting the access and refresh token was null");
            }

            if (response.IsSuccessStatusCode)
            {
                JObject accessTokenResponseBody = JObject.Parse(await response.Content.ReadAsStringAsync());

                string accessToken = accessTokenResponseBody["access_token"].ToString();

                string currentUserId = await GetCurrentUserIdAsync(accessToken);

                await _spotifyAuthentication.AddAuthenticatedPartyGoerAsync(currentUserId, accessTokenResponseBody["access_token"].ToString(), accessTokenResponseBody["refresh_token"].ToString());

                return currentUserId;

            }

            return null;
        }
        private async Task<string> GetCurrentUserIdAsync(string accessToken)
        {
            string apiEndpoint = "https://api.spotify.com/v1/me";

            HttpResponseMessage response = null;

            using (var requestMessage = new HttpRequestMessage(HttpMethod.Get, apiEndpoint))
            {
                requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                response = await _httpClient.SendAsync(requestMessage);
            }

            if (response == null || !response.IsSuccessStatusCode)
            {
                throw new Exception("Could not get user details while logging a user in.");
            }

            string responseContent = await response.Content.ReadAsStringAsync();

            JObject currentUser = JObject.Parse(responseContent);

            return currentUser["id"].ToString();
        }
        public async Task<CurrentSongDTO> GetCurrentSongAsync(string partyGoerId)
        {
            string apiEndpoint = "https://api.spotify.com/v1/me/player/currently-playing";

            string token = await _spotifyAuthentication.GetAccessTokenForPartyGoerAsync(partyGoerId);

            HttpResponseMessage response;

            using (var requestMessage = new HttpRequestMessage(HttpMethod.Get, apiEndpoint))
            {
                requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                response = await _httpClient.SendAsync(requestMessage);
            }

            response.EnsureSuccessStatusCode();

            string responseContent = await response.Content.ReadAsStringAsync();

            JObject currentSong = JObject.Parse(responseContent);

            return new CurrentSongDTO
            {
                Artist = currentSong["item"]["artists"][0]["name"].ToString(),
                Album = currentSong["item"]["album"]["name"].ToString(),
                ProgressMs = Convert.ToInt32(currentSong["progress_ms"].ToString()),
                Title = currentSong["item"]["name"].ToString(),
                TrackUri = currentSong["item"]["uri"].ToString(),
                AlbumArtUrl = currentSong["item"]["album"]["images"][0]["url"].ToString()
            };
        }

        public async Task<bool> UpdateSongForPartyGoerAsync(string partyGoerId, CurrentSongDTO currentSong)
        {
            string apiEndpoint = "https://api.spotify.com/v1/me/player/play";

            string token = await _spotifyAuthentication.GetAccessTokenForPartyGoerAsync(partyGoerId);

            HttpResponseMessage response;

            using (var requestMessage = new HttpRequestMessage(HttpMethod.Put, apiEndpoint))
            {
                requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                requestMessage.Content = new StringContent(JsonConvert.SerializeObject(new StartUserPlaybackSong
                {
                    uris = new List<string> { currentSong.TrackUri },
                    position_ms = currentSong.ProgressMs
                }));

                response = await _httpClient.SendAsync(requestMessage);
            }

            if (response.IsSuccessStatusCode)
            {
                return true;
            }
            else
            {
                return false;
            }
        }
    }
}
