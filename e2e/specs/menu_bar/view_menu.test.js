// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

const fs = require('fs');

const robot = require('robotjs');

const env = require('../../modules/environment');
const {asyncSleep} = require('../../modules/utils');

async function setupPromise(window, id) {
    const promise = new Promise((resolve) => {
        const browserView = window.getBrowserViews().find((view) => view.webContents.id === id);
        browserView.webContents.on('did-finish-load', () => {
            resolve();
        });
    });
    await promise;
    return true;
}

function robotKeyTaps(n, ...params) {
    for (let i = 0; i < n; i++) {
        robot.keyTap(...params);
    }
}

async function clickThreeDotMenu(app) {
    const mainWindow = app.windows().find((window) => window.url().includes('index'));
    await mainWindow.click('button.three-dot-menu');
}

async function windowEventPromise(app) {
    return new Promise((res) => {
        app.on('window', (window) => {
            res(window);
        });
    });
}

describe('mattermost', function desc() {
    this.timeout(30000);

    const config = env.demoMattermostConfig;

    beforeEach(async () => {
        env.cleanDataDir();
        env.createTestUserDataDir();
        env.cleanTestConfig();
        fs.writeFileSync(env.configFilePath, JSON.stringify(config));
        await asyncSleep(1000);
        this.app = await env.getApp();
        this.serverMap = await env.getServerMap(this.app);
    });

    afterEach(async () => {
        if (this.app) {
            await this.app.close();
        }
    });

    it('MM-T813 Control+F should focus the search bar in Mattermost', async () => {
        const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
        await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        const firstServer = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].win;
        await env.loginToMattermost(firstServer);
        await firstServer.waitForSelector('#searchBox');
        robot.keyTap('f', [process.platform === 'darwin' ? 'command' : 'control']);
        await asyncSleep(500);
        const isFocused = await firstServer.$eval('#searchBox', (el) => el === document.activeElement);
        isFocused.should.be.true;
        const text = await firstServer.inputValue('#searchBox');
        text.should.include('in:');
    });

    describe('Reload', () => {
        let browserWindow;
        let webContentsId;

        beforeEach(async () => {
            const mainWindow = await this.app.firstWindow();
            browserWindow = await this.app.browserWindow(mainWindow);
            webContentsId = this.serverMap[`${config.teams[0].name}___TAB_MESSAGING`].webContentsId;

            const loadingScreen = this.app.windows().find((window) => window.url().includes('loadingScreen'));
            await loadingScreen.waitForSelector('.LoadingScreen', {state: 'hidden'});
        });

        it('MM-T814 should reload page when pressing Ctrl+R', async () => {
            const check = browserWindow.evaluate(setupPromise, webContentsId);
            await asyncSleep(500);
            robot.keyTap('r', ['control']);
            const result = await check;
            result.should.be.true;
        });

        it('MM-T815 should reload page when pressing Ctrl+Shift+R', async () => {
            const check = browserWindow.evaluate(setupPromise, webContentsId);
            await asyncSleep(500);
            robot.keyTap('r', ['control', 'shift']);
            const result = await check;
            result.should.be.true;
        });

        it('MM-T820 should open dev tools for Application Wrapper when pressing keyboard shortcuts', async () => {
            const macModifierKeys = ['command', 'alt'];
            const winModifierKeys = ['shift', 'control'];

            const windowLoaded = windowEventPromise(this.app);
            robotKeyTaps(1, 'i', process.platform === 'darwin' ? macModifierKeys : winModifierKeys);

            const window = await windowLoaded;
            const windowTitle = await window.title();

            const isWindowTitleDevTools = windowTitle === 'DevTools';
            isWindowTitleDevTools.should.be.true;
        });
    });
});
