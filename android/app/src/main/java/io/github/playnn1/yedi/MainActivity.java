package io.github.playnn1.yedi;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.util.Collections;

/** Small offline shell. The game, sounds and score storage stay on the device. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView webView;
    private FrameLayout root;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(237,243,241));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
            } else {
                int left=insets.getSystemWindowInsetLeft(),top=insets.getSystemWindowInsetTop();
                int right=insets.getSystemWindowInsetRight(),bottom=insets.getSystemWindowInsetBottom();
                if (Build.VERSION.SDK_INT >= 28 && insets.getDisplayCutout()!=null) {
                    top=Math.max(top,insets.getDisplayCutout().getSafeInsetTop());
                    bottom=Math.max(bottom,insets.getDisplayCutout().getSafeInsetBottom());
                }
                view.setPadding(left,top,right,bottom);
            }
            return insets;
        });
        setContentView(root);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(237,243,241));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        final WebViewAssetLoader loader=new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request) {
                WebResourceResponse response=loader.shouldInterceptRequest(request.getUrl());
                if(response!=null)return response;
                return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri url=request.getUrl();
                return !"https".equals(url.getScheme()) || !HOST.equals(url.getHost()) || !url.getPath().startsWith("/assets/");
            }
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail) {
                root.removeView(view);view.destroy();webView=null;recreate();return true;
            }
        });
        root.addView(webView,new FrameLayout.LayoutParams(-1,-1));
        immersive();
        webView.loadUrl("https://"+HOST+"/assets/index.html");
    }
    @SuppressWarnings("deprecation") private void immersive() {
        if(Build.VERSION.SDK_INT>=30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller=getWindow().getInsetsController();
            if(controller!=null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.systemBars());
            }
        } else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        root.requestApplyInsets();
    }
    @Override public void onWindowFocusChanged(boolean focus) {super.onWindowFocusChanged(focus);if(focus)immersive();}
    @Override protected void onPause() {
        if(webView!=null) {webView.evaluateJavascript("window.yedi&&yedi.pause()",null);webView.onPause();}
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if(webView!=null) {webView.onResume();webView.evaluateJavascript("window.yedi&&yedi.start()",null);}
    }
    @Override @SuppressWarnings("deprecation") public void onBackPressed() {
        if(webView==null){finish();return;}
        webView.evaluateJavascript("(function(){if(window.yedi&&!yedi.ui.overlay){yedi.overlay('pause');return 'paused'}return 'exit'})()",result -> {
            if(!"\"exit\"".equals(result)||isFinishing())return;
            new AlertDialog.Builder(this).setTitle("退出游戏？").setMessage("最高分会保留，下次打开开始新的一场。")
                .setPositiveButton("退出",(dialog,which)->finish())
                .setNegativeButton("继续游戏",(dialog,which)->{if(webView!=null)webView.evaluateJavascript("window.yedi&&yedi.overlay(null)",null);}).show();
        });
    }
    @Override protected void onDestroy() {
        if(webView!=null){root.removeView(webView);webView.destroy();webView=null;}
        super.onDestroy();
    }
}
