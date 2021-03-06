﻿const signalR = require("@microsoft/signalr")
const u = require("umbrellajs");
import { fromEvent, interval, of, pipe, observable, defer, Observable } from 'rxjs';
import { debounce, map, catchError, startWith } from 'rxjs/operators';
import { ajax } from 'rxjs/ajax';

module.exports = {
    RealtimeFunctionality: function ConnectToParty(partyCode: string) {
        console.log("Connecting to real time server");
        const connection = new signalR.HubConnectionBuilder().withUrl("/partyhub").build();

        connection.start().then(() => connection.invoke("ConnectToParty", partyCode));

        connection.on("UpdateParty", (msg: string) => {
            console.log(msg);
        })

        connection.on("UpdatePartyView", (current: CurrentSong, history: Song[], queue: Song[]) => {
            UpdateCurrentSong(current.song, current.position);
            UpdateHistory(history);
            UpdateQueue(queue);

            console.log(current);
            console.log(history);
            console.log(queue);
        })

        connection.on("UpdateSong", (song: CurrentSong) => {
            UpdateSong(song.song);

            console.log(song);
        })

        connection.on("NewListener", (userName: string) => {
            console.log(userName)
            u("#listeners").append(`<p>${userName}</p>`)
        })

        connection.on("ConnectSpotify", (msg: string) => {
            console.log("Users Spotify is disconnected");

            u("#card-content").html("<p>It looks like your Spotify got disconnected from us. This might be because your Spotify app was closed. Make sure your Spotify app is open on whatever device you want to listen through and start playing a song and press the button below to see if we can find your Spotify</p>");
            u(".modal").addClass("is-active")
        })

        fromEvent(document.getElementById("search-spotify-input"), 'input').subscribe(event => {
            u("#results").empty();
            u("#results").siblings("#loader").addClass("is-active");
        })

        u("#is-search-spotify-wrapper").on("mouseleave", (event) => {
            u("#is-search-spotify-wrapper").removeClass("increment-search-box")
            u("#results").addClass("hidden")
        })

        u("#search-spotify-input").on("input", (event) => {
            u("#is-search-spotify-wrapper").addClass("increment-search-box")
            u("#results").removeClass("hidden")
        })

        /*
        u("#results").find("li").on('click', (event) => {
            console.log("Adding song to playlist");
            connection.invoke("UserAddedSong", {
                partyCode: partyCode,
                indexToInsertSongAt: null,
                trackUri: event.target.dataset.trackuri,
                albumImageUrl: event.target.dataset.albumimageurl,
                title: event.target.dataset.title,
                artist: event.target.dataset.artist,
                length: parseInt(event.target.dataset.length)
            });
        })
        */

        fromEvent(document.getElementById("search-spotify-input"), 'input').pipe(debounce(() => interval(1500))).subscribe(event => {
            console.log((<HTMLInputElement>event.target).value);

            ajax.getJSON(`/api/user/searchSpotify?query=${(<HTMLInputElement>event.target).value}`).pipe(
                catchError(error => {
                    console.log('error: ', error);
                    return of(error);
                })).subscribe(response => {
                    console.log("response");
                    console.log(response);
                    // remove loading icon
                    u("#loader").removeClass("is-active");
                    u("#results").removeClass("hidden");
                    (<SongModel[]>response).map(song => {
                        u("#results").append(`<li tabindex="" data-albumimageurl=${song.albumImageUrl} data-title=${song.title} data-artist=${song.artist} data-length=${song.length} data-trackuri=${song.trackUri}> <span>${song.title} < /span><span class="artist">${song.artist}</span > </li>`)
                    })
                })
        });

        function UpdateCurrentSong(song: Song, position: number) {
            document.getElementById("albumArt").setAttribute("src", song.albumImageUrl);
            document.getElementById("track").innerText = song.title;
            document.getElementById("artist").innerText = song.artist;
        }

        function UpdateHistory(history: Song[]) {
            u("#history").siblings("#loader").removeClass("is-active");
            u("#history").empty();
            history.map(song => {
                u("#history").append(`<tr><td>${song.title}</td><td>${song.artist}</td></tr>`)
            })
        }

        function UpdateQueue(queue: Song[]) {
            u("#queue").siblings("#loader").removeClass("is-active");
            u("#queue").empty();
            console.log("Start of update queue")
            queue.map(song => {
                u("#queue").append(`<tr><td>${song.title}</td><td>${song.artist}</td></tr>`)
                //u("#queue").append(`<div>${song.title}</div>`)
            })

            MakeFirstQueueElementHidden()

            let element = document.getElementById("queue");
            // @ts-ignore
            var sortable = Sortable.create(element, {
                group: 'shared',
                animation: 300,
                easing: "cubic-bezier(0.76, 0, 0.24, 1)",
                ghostClass: "has-background-white-ter",
                chosenClass: "has-background-info-light",
                dragClass: "has-background-info-light",
                onEnd: (evt) => {
                    console.log(evt);

                    if (evt.oldIndex !== evt.newIndex) {
                        connection.invoke("UserModifiedPlaylist", {
                            partyCode: partyCode,
                            oldTrackIndex: evt.oldIndex,
                            newTrackIndex: evt.newIndex
                        })
                    }
                },
                onAdd: (evt) => {
                    console.log(evt);

                    console.log({
                        partyCode: partyCode,
                        indexToInsertSongAt: evt.newIndex,
                        trackUri: evt.item.dataset.trackuri,
                        albumArtUrl: evt.item.dataset.albumarturl,
                        title: evt.item.dataset.title,
                        artist: evt.item.dataset.artist,
                        length: evt.item.dataset.length
                    })

                    connection.invoke("UserAddedSong", {
                        partyCode: partyCode,
                        indexToInsertSongAt: evt.newIndex,
                        trackUri: evt.item.dataset.trackuri,
                        albumImageUrl: evt.item.dataset.albumimageurl,
                        title: evt.item.dataset.title,
                        artist: evt.item.dataset.artist,
                        length: parseInt(evt.item.dataset.length)
                    });
                }
            });
        }

        function MakeFirstQueueElementHidden() {
            let element = u("#queue").children().first();
            u(element).addClass("hidden");
        }

        function UpdateSong(song: Song) {
            UpdateCurrentSong(song, 0);
            RemoveFirstSongFromQueue();
        }

        function RemoveFirstSongFromQueue() {
            let songToMoveToHistory = u("#queue").children().first();
            u("#history").append(songToMoveToHistory);
            let songInHistory = u("#history").children().last();
            u(songInHistory).removeClass("hidden");
            songToMoveToHistory.remove();
            MakeFirstQueueElementHidden();
        }
    },
    CheckForActiveSpotifyConnection: function CheckForActiveSpotifyConnection() {
        console.log("Checking for active spotify connection");
        fetch("/api/user/CheckSpotifyForConnection")
            .then(response =>
                response.json()
            ).then(device => {
                console.log(device)
                if (device.deviceName != null) {
                    u(".modal").removeClass("is-active")

                    // The user has a device that is connected, we need to update him with where we are in the song
                    fetch("/party/UpdateSongForUser")
                        .then(response => {
                            if (response.status != 200) {
                                console.log("There was an issue with syncing the music for the user");
                            }
                        });
                }
            })
    },
    SyncMusicForUser: function SyncMusicForUser() {
        fetch("/party/UpdateSongForUser")
            .then(response => {
                if (response.status != 200) {
                    console.log("There was an issue with syncing the music for the user");
                }
            });
    },
    CloseModal: function CloseModal() {
        u(".modal").removeClass("is-active");
    }
}

class Song {
    title: string;
    artist: string;
    length: number;
    albumImageUrl: string
}

class SongModel {
    title: string;
    artist: string;
    length: number;
    albumImageUrl: string;
    trackUri: string;
}

class CurrentSong {
    song: Song;
    position: number
}